export type Species = "dog" | "cat";

export type PetSize = "small" | "medium" | "large";

export interface Pet {
	id: number
	name: string
	breed: string
	age: number
	size: PetSize
	species: Species
	sex: 'male' | 'female'
	city: string
	traits: string[]
	emoji: string
	publisherName: string
	adopted: boolean
	vaccinated: boolean
	neutered: boolean
}

export const CITIES: string[] = ["Warszawa", "Kraków", "Wrocław", "Gdańsk", "Poznań"];

export const BREEDS_BY_SPECIES: Record<Species, string[]> = {
	dog: ["Golden Retriever", "German Shepherd", "French Bulldog", "Border Collie", "Poodle"],
	cat: ["British Shorthair", "Maine Coon", "Siamese", "Persian", "Scottish Fold"]
};

export const ALL_TRAITS: string[] = ["friendly", "playful", "calm", "shy", "energetic", "wild", "cuddly", "loyal", "protective"];

export const SAMPLE_PETS: Pet[] = [
	{
		id: 1,
		name: 'Karo',
		breed: 'Golden Retriever',
		age: 2,
		size: 'large',
		species: 'dog',
		sex: 'male',
		city: 'Warszawa',
		traits: ['friendly', 'playful'],
		emoji: '🐕',
		publisherName: 'Murat',
		adopted: false,
		vaccinated: true,
		neutered: true
	},

	{
		id: 2,
		name: 'Kobi',
		breed: 'Maine Coon',
		age: 3,
		size: 'small',
		species: 'cat',
		sex: 'female',
		city: 'Gdańsk',
		traits: ['wild', 'shy'],
		emoji: '🐈‍⬛',
		publisherName: 'Enes',
		adopted: false,
		vaccinated: true,
		neutered: false
	},

	{
		id: 3,
		name: 'Halo',
		breed: 'Poodle',
		age: 1,
		size: 'medium',
		species: 'dog',
		sex: 'male',
		city: 'Kraków',
		traits: ['friendly', 'energetic'],
		emoji: '🐶',
		publisherName: 'Ben',
		adopted: false,
		vaccinated: false,
		neutered: true
	},
	
	{
        id: 4,
        name: 'Luna',
        breed: 'British Shorthair',
        age: 1,
        size: 'small',
        species: 'cat',
        sex: 'female',
        city: 'Wrocław',
        traits: ['calm', 'cuddly'],
        emoji: '🐈',
        publisherName: 'Zeynep',
        adopted: false,
        vaccinated: true,
        neutered: true
    },

    {
        id: 5,
        name: 'Max',
        breed: 'German Shepherd',
        age: 4,
        size: 'large',
        species: 'dog',
        sex: 'male',
        city: 'Poznań',
        traits: ['loyal', 'protective'],
        emoji: '🐕‍🦺',
        publisherName: 'Alex',
        adopted: false,
        vaccinated: true,
        neutered: true
    }
];

export const AGE_BUCKETS: { id: string; label: string; test: (age: number) => boolean }[] = [
	{ id: 'all', label: 'Any age', test: () => true },
	{ id: 'puppy', label: 'Puppy (0–1)', test: (age: number) => age < 1 },
	{ id: 'young', label: 'Young (1–3)', test: (age: number) => age >= 1 && age < 3 },
	{ id: 'adult', label: 'Adult (3–7)', test: (age: number) => age >= 3 && age < 7 },
	{ id: 'senior', label: 'Senior (7+)', test: (age: number) => age >= 7 },
];