from django.apps import AppConfig

from analytics import handlers, signals


class AnalyticsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'analytics'

    def ready(self):
        signals.pet_viewed.connect(handlers.handle_pet_viewed)
        signals.inquiry_opened.connect(handlers.handle_inquiry_opened)
        signals.message_sent.connect(handlers.handle_message_sent)
        signals.adoption_completed.connect(handlers.handle_adoption_completed)
        signals.listing_published.connect(handlers.handle_listing_published)
        signals.user_registered.connect(handlers.handle_user_registered)
