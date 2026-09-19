export type Species = "dog" | "cat";

export type PetSize = "small" | "medium" | "large";

export interface Pet {
	id: string
	name: string
	species: Species
	breed: string
	age: number
	size: PetSize
	sex: 'male' | 'female'
	city: string
	description: string
	traits: string[]
	emoji: string
	tile: string
	photo: string | null
	ownerId: string
	adoptedById: string | null
	postedAt: string
	vaccinated: boolean
	neutered: boolean
}

export interface User {
	id: string
	name: string
	avatar: string | null
	online: boolean
}

export const USERS: User[] = [
	{ id: 'u1', name: 'Murat', avatar: null, online: true },
	{ id: 'u2', name: 'Enes', avatar: null, online: false },
	{ id: 'u3', name: 'Ben', avatar: null, online: true },
	{ id: 'u4', name: 'Zeynep', avatar: null, online: false },
	{ id: 'u5', name: 'Alex', avatar: null, online: true },
]

export const CITIES: string[] = ["Warszawa", "Kraków", "Łódź", "Wrocław", "Poznań", "Gdańsk", "Szczecin", "Katowice", "Lublin"]

export const BREEDS_BY_SPECIES: Record<Species, string[]> = {
	dog: ["Golden Retriever", "German Shepherd", "French Bulldog", "Border Collie", "Poodle"],
	cat: ["British Shorthair", "Maine Coon", "Siamese", "Persian", "Scottish Fold"]
};

export const ALL_TRAITS: string[] = ["friendly", "playful", "calm", "shy", "energetic", "wild", "cuddly", "loyal", "protective"];

export const SAMPLE_PETS: Pet[] = [
	{
		id: '1',
		name: 'Karo',
		breed: 'Golden Retriever',
		age: 2,
		size: 'large',
		species: 'dog',
		sex: 'male',
		city: 'Warszawa',
		traits: ['friendly', 'playful'],
		emoji: '🐕',
		tile: 'bg-honey-100',
		photo: null,
		ownerId: 'u1',
		adoptedById: null,
		postedAt: '2026-01-15',
		vaccinated: true,
		neutered: true,
		description: 'A friendly and energetic Golden Retriever looking for a active family.'
	},
	{
		id: '2',
		name: 'Kobi',
		breed: 'Maine Coon',
		age: 3,
		size: 'small',
		species: 'cat',
		sex: 'female',
		city: 'Gdańsk',
		traits: ['wild', 'shy'],
		emoji: '🐈‍⬛',
		tile: 'bg-honey-100',
		photo: null,
		ownerId: 'u2',
		adoptedById: null,
		postedAt: '2026-01-16',
		vaccinated: true,
		neutered: false,
		description: 'A beautiful Maine Coon who takes a little time to warm up to new friends.'
	},
	{
		id: '3',
		name: 'Halo',
		breed: 'Poodle',
		age: 1,
		size: 'medium',
		species: 'dog',
		sex: 'male',
		city: 'Kraków',
		traits: ['friendly', 'energetic'],
		emoji: '🐶',
		tile: 'bg-honey-100',
		photo: null,
		ownerId: 'u3',
		adoptedById: null,
		postedAt: '2026-01-17',
		vaccinated: false,
		neutered: true,
		description: 'Friendly and active Poodle puppy eager to run and play.'
	},
	{
		id: '4',
		name: 'Luna',
		breed: 'British Shorthair',
		age: 1,
		size: 'small',
		species: 'cat',
		sex: 'female',
		city: 'Wrocław',
		traits: ['calm', 'cuddly'],
		emoji: '🐈',
		tile: 'bg-honey-100',
		photo: null,
		ownerId: 'u4',
		adoptedById: null,
		postedAt: '2026-01-18',
		vaccinated: true,
		neutered: true,
		description: 'Calm and affectionate British Shorthair who loves lap cuddles.'
	},
	{
		id: '5',
		name: 'Max',
		breed: 'German Shepherd',
		age: 4,
		size: 'large',
		species: 'dog',
		sex: 'male',
		city: 'Poznań',
		traits: ['loyal', 'protective'],
		emoji: '🐕‍🦺',
		tile: 'bg-honey-100',
		photo: null,
		ownerId: 'u5',
		adoptedById: null,
		postedAt: '2026-01-19',
		vaccinated: true,
		neutered: true,
		description: 'Loyal and protective German Shepherd, well-trained and smart.'
	}
];

export const AGE_BUCKETS: { id: string; label: string; test: (age: number) => boolean }[] = [
	{ id: 'all', label: 'Any age', test: () => true },
	{ id: 'puppy', label: 'Puppy (under 1)', test: (age: number) => age < 1 },
	{ id: 'young', label: 'Young (1–3)', test: (age: number) => age >= 1 && age < 3 },
	{ id: 'adult', label: 'Adult (3–7)', test: (age: number) => age >= 3 && age < 7 },
	{ id: 'senior', label: 'Senior (7+)', test: (age: number) => age >= 7 },
];