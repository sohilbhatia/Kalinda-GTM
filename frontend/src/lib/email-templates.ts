const STORAGE_PREFIX = "kalinda-email-tpl-";

export const TEMPLATE_KEYS = {
  noPickUp: "noPickUp",
  callBack: "callBack",
  massTort: "massTort",
} as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[keyof typeof TEMPLATE_KEYS];

export const DEFAULT_TEMPLATES: Record<TemplateKey, string> = {
  noPickUp: `Hey {firstName},

Saw you're going to MTMP in Vegas this week - I'll be there too.

{personalization}

I called your firm's intake line yesterday but no one picked it up and I went straight to voicemail.

My brother and I are the co-founders of Kalinda. We built an AI voice agent to intake cases + consistently follow up with plaintiffs 24/7 through calls and texts. It never sleeps and works around the plaintiff's schedule.

Could we chat with you for 10 mins during the conference outside the exhibit hall or at the coffee stations?

Best,

Sohil Bhatia
Co-founder, kalinda.ai

P.S Caffé Al Teatro is a super underrated ice cream parlor in the Wynn`,

  callBack: `Hey {firstName},

Saw you're going to MTMP in Vegas this week - I'll be there too.

{personalization}

I called your firm's intake line yesterday and asked to get a call back later in the day, but they said the earliest I could get a call back for my intake would be Monday.

My brother and I are the co-founders of Kalinda. We built an AI voice agent to intake cases + consistently follow up with plaintiffs 24/7 through calls and texts. It never sleeps and works around the plaintiff's schedule.

Could we chat with you for 10 mins during the conference outside the exhibit hall or at the coffee stations?

Best,

Sohil Bhatia
Co-founder, kalinda.ai

P.S Caffé Al Teatro is a super underrated ice cream parlor in the Wynn`,

  massTort: `Hey {firstName},

Saw you're going to MTMP in Vegas this week - I'll be there too.

{personalization}

My brother and I are the founders of Kalinda. We're helping mass tort firms intake & consistently follow up with their plaintiffs 24/7 with our AI voice agent. It literally treats the plaintiff like it's the firm's only one.

Recently for a depo provera firm, Kalinda was on the phone for 45 mins with a plaintiff helping gather product usage and meningioma injury info. We're curious what your use case could be since you've been filing {massTort} cases.

Could we chat with you for 10 mins during the conference outside the exhibit hall or at the coffee stations?

Best,

Sohil Bhatia
Co-founder, kalinda.ai

P.S Caffé Al Teatro is a super underrated ice cream parlor in the Wynn`,
};

export function getTemplate(key: TemplateKey): string {
  if (typeof window === "undefined") return DEFAULT_TEMPLATES[key];
  return localStorage.getItem(STORAGE_PREFIX + key) || DEFAULT_TEMPLATES[key];
}

export function saveTemplate(key: TemplateKey, value: string): void {
  localStorage.setItem(STORAGE_PREFIX + key, value);
}

export function resetTemplate(key: TemplateKey): void {
  localStorage.removeItem(STORAGE_PREFIX + key);
}

export function fillTemplate(
  template: string,
  vars: { firstName: string; personalization: string; massTort?: string },
): string {
  return template
    .replace(/\{firstName\}/g, vars.firstName)
    .replace(/\{personalization\}/g, vars.personalization)
    .replace(/\{massTort\}/g, vars.massTort || "");
}
