// The waitlist form: shows a Cloudflare Turnstile widget, then posts the email address and
// the widget's token to /api/waitlist (worker/index.ts).

interface TurnstileOptions {
    sitekey: string;
    callback: (token: string) => void;
    'expired-callback': () => void;
    'error-callback': (code: string) => boolean;
}

declare global {
    interface Window {
        turnstile?: { render(el: HTMLElement, options: TurnstileOptions): string; reset(id?: string): void };
    }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function loadTurnstile(): Promise<NonNullable<Window['turnstile']>> {
    return new Promise((resolve, reject) => {
        if (window.turnstile) return resolve(window.turnstile);
        const script = document.createElement('script');
        script.src = SCRIPT;
        script.async = true;
        script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile did not load')));
        script.onerror = () => reject(new Error('Turnstile did not load'));
        document.head.append(script);
    });
}

export async function mountWaitlist(form: HTMLFormElement): Promise<void> {
    const widget = form.querySelector<HTMLElement>('[data-turnstile]')!;
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const status = form.querySelector<HTMLElement>('[role="status"]')!;
    let token = '';
    let widgetId: string | undefined;
    let reported = false;

    const say = (text: string) => (status.textContent = text);

    try {
        const [{ siteKey }, turnstile] = await Promise.all([
            fetch('/api/config').then((r) => r.json() as Promise<{ siteKey: string }>),
            loadTurnstile(),
        ]);
        widgetId = turnstile.render(widget, {
            sitekey: siteKey,
            callback: (t) => {
                token = t;
                button.disabled = false;
            },
            'expired-callback': () => {
                token = '';
                button.disabled = true;
            },
            'error-callback': (code) => {
                token = '';
                button.disabled = true;
                say('The spam check could not load, so the form is switched off for now.');
                if (!reported) {
                    reported = true;
                    void fetch('/api/turnstile-error', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code, hostname: location.hostname }),
                        keepalive: true,
                    });
                }
                return true;
            },
        });
    } catch {
        say('The spam check could not load. Check your connection and reload the page.');
        return;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = new FormData(form).get('email');
        button.disabled = true;
        say('Joining…');
        const res = await fetch('/api/waitlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, token }),
        }).catch(() => null);
        const body = (await res?.json().catch(() => ({}))) as { ok?: boolean; error?: string } | undefined;
        if (res?.ok && body?.ok) {
            form.reset();
            say("Thanks! You're on the list.");
        } else {
            say(body?.error ?? 'Something went wrong. Try again in a moment.');
        }
        // Each token works once, so get a fresh one for the next try.
        token = '';
        window.turnstile?.reset(widgetId);
    });
}
