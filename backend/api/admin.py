from django.contrib import admin

from .models import APIKey


@admin.register(APIKey)
class APIKeyAdmin(admin.ModelAdmin):
    list_display = ['owner', 'label', 'prefix', 'revoked', 'rate_per_minute', 'created_at', 'last_used_at']
    fields = ['owner', 'label', 'prefix', 'hash_preview', 'rate_per_minute', 'revoked', 'created_at', 'last_used_at']
    readonly_fields = ['owner', 'prefix', 'hash_preview', 'created_at', 'last_used_at']

    # Keys are created only through POST /api/keys/, the one place the plaintext key is shown.
    def has_add_permission(self, request):
        return False

    @admin.display(description='Key hash')
    def hash_preview(self, obj):
        return f'{obj.key_hash[:8]}…'
