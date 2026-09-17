// -- Author Dictionary --

export type Author = {
  id: string;
  name: string;
  role: string;
  avatar: string;
  bio: string;
};

export const AUTHORS = {
  luis: {
    id: 'luis',
    name: 'Luis Martinez',
    role: 'Founder',
    avatar: 'https://lh3.googleusercontent.com/a/ACg8ocJhJ7X_7wOzsxme7XWz7hIz9ViDaCbgKwHnusloqpJQB900MBYH=s288-c-no',
    bio: 'Building SafelyFed to help people eat safely, at home and abroad.',
  },
} as const satisfies Record<string, Author>;

// -- Category Dictionary --

export type Category = {
  slug: string;
  label: string;
  description: string;
};

export const CATEGORIES = {
  // Content types
  'country-guides': {
    slug: 'country-guides',
    label: 'Country Guides',
    description: 'Destination-specific safety guides for eating abroad.',
  },
  'allergen-rankings': {
    slug: 'allergen-rankings',
    label: 'Safety Rankings',
    description: 'Data-driven country rankings by restriction type.',
  },
  'hidden-allergens': {
    slug: 'hidden-allergens',
    label: 'Hidden Hazards',
    description: 'Ingredient deep dives exposing non-obvious dangers in global cooking.',
  },
  // Allergens
  celiac: {
    slug: 'celiac',
    label: 'Celiac & Gluten-Free',
    description: 'Guides for celiac disease and gluten-free needs.',
  },
  'peanut-allergy': {
    slug: 'peanut-allergy',
    label: 'Peanut Allergy',
    description: 'Guides for managing peanut sensitivities abroad.',
  },
  'soy-allergy': {
    slug: 'soy-allergy',
    label: 'Soy Allergy',
    description: 'Guides for managing soy sensitivities and hidden soy in Asian cuisines.',
  },
  'coconut-allergy': {
    slug: 'coconut-allergy',
    label: 'Coconut Allergy',
    description: 'Guides for managing coconut sensitivities, especially in Southeast Asian cuisines.',
  },
  'dairy-allergy': {
    slug: 'dairy-allergy',
    label: 'Dairy Allergy',
    description: 'Guides for managing dairy sensitivities or lactose intolerance.',
  },
  'shellfish-allergy': {
    slug: 'shellfish-allergy',
    label: 'Shellfish Allergy',
    description: 'Guides for managing shellfish and crustacean sensitivities.',
  },
  'fish-allergy': {
    slug: 'fish-allergy',
    label: 'Fish Allergy',
    description: 'Guides for managing fish sensitivities, including hidden fish stock.',
  },
  // Countries
  thailand: {
    slug: 'thailand',
    label: 'Thailand',
    description: 'Guides for eating safely in Thailand.',
  },
  japan: {
    slug: 'japan',
    label: 'Japan',
    description: 'Guides for eating safely in Japan.',
  },
  india: {
    slug: 'india',
    label: 'India',
    description: 'Guides for eating safely in India.',
  },
  mexico: {
    slug: 'mexico',
    label: 'Mexico',
    description: 'Guides for eating safely in Mexico.',
  },
  italy: {
    slug: 'italy',
    label: 'Italy',
    description: 'Guides for eating safely in Italy.',
  },
} as const satisfies Record<string, Category>;
