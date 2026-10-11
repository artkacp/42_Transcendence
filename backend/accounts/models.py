import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.db.models import F, Q
from django.utils.text import slugify


class UserManager(BaseUserManager):
    def generate_handle(self, full_name):
        base = slugify(full_name).replace('-', '.')[:40] or 'user'
        handle = base
        suffix = 1
        while self.filter(handle=handle).exists():
            suffix += 1
            handle = f'{base}{suffix}'
        return handle

    def create_user(self, email, full_name, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email).lower()
        if 'handle' not in extra_fields:
            extra_fields['handle'] = self.generate_handle(full_name)
        user = self.model(email=email, full_name=full_name, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, full_name, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, full_name, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, max_length=254)
    full_name = models.CharField(max_length=150)
    handle = models.CharField(max_length=50, unique=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    bio = models.TextField(blank=True)
    avatar = models.FileField(upload_to='avatars/', null=True, blank=True)
    is_online = models.BooleanField(default=False)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    date_joined = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    objects = UserManager()

    def __str__(self):
        return self.email


class Friendship(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_ACCEPTED = 'accepted'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_ACCEPTED, 'Accepted'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requester = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='sent_requests',
    )
    addressee = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='received_requests',
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['requester', 'addressee'],
                name='unique_friendship_pair',
            ),
            models.CheckConstraint(
                check=~Q(requester=F('addressee')),
                name='no_self_friendship',
            ),
        ]
