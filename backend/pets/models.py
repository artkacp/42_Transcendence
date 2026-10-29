import uuid

from django.contrib.postgres.fields import ArrayField
from django.contrib.postgres.indexes import GinIndex
from django.db import models

from core.uploads import UploadTo


SPECIES_CHOICES = [('dog', 'Dog'), ('cat', 'Cat')]
SIZE_CHOICES = [('small', 'Small'), ('medium', 'Medium'), ('large', 'Large')]
SEX_CHOICES = [('male', 'Male'), ('female', 'Female')]
CITIES = ['Warszawa', 'Kraków', 'Łódź', 'Wrocław', 'Poznań', 'Gdańsk', 'Szczecin', 'Katowice', 'Lublin']
BREEDS = {
    'dog': ['Golden Retriever', 'German Shepherd', 'French Bulldog', 'Border Collie', 'Poodle'],
    'cat': ['British Shorthair', 'Maine Coon', 'Siamese', 'Persian', 'Scottish Fold'],
}
TRAITS = ['friendly', 'playful', 'calm', 'shy', 'energetic', 'wild', 'cuddly', 'loyal', 'protective']
AGE_BUCKETS = {'under_1': (0, 0), '1_3': (1, 3), '4_7': (4, 7), '8_plus': (8, 20)}


class Pet(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='pets',
    )
    name = models.CharField(max_length=100)
    species = models.CharField(max_length=10, choices=SPECIES_CHOICES)
    breed = models.CharField(max_length=100)
    age_years = models.SmallIntegerField()
    size = models.CharField(max_length=10, choices=SIZE_CHOICES)
    sex = models.CharField(max_length=10, choices=SEX_CHOICES)
    city = models.CharField(max_length=100)
    story = models.TextField()
    traits = ArrayField(models.CharField(max_length=50), size=4, default=list)
    photo = models.FileField(upload_to=UploadTo('pets'), null=True, blank=True)
    is_vaccinated = models.BooleanField(default=False)
    is_neutered = models.BooleanField(default=False)
    adopted_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='adopted_pets',
    )
    adopted_at = models.DateTimeField(null=True, blank=True)
    search_text = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        self.search_text = ' '.join([self.name, self.breed, *self.traits])
        super().save(*args, **kwargs)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(age_years__gte=0) & models.Q(age_years__lte=40),
                name='pet_age_valid_range',
            ),
            models.CheckConstraint(
                condition=models.Q(story__regex=r'[\s\S]{20}'),
                name='pet_story_min_length',
            ),
        ]
        indexes = [
            models.Index(fields=['-created_at'], name='pet_created_at_idx'),
            GinIndex(fields=['search_text'], name='pet_search_text_gin_idx', opclasses=['gin_trgm_ops']),
            models.Index(fields=['species', 'size', 'city'], name='pet_species_size_city_idx'),
        ]
