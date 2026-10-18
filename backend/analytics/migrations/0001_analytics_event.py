from django.db import migrations

SQL_CREATE = """
CREATE TABLE analytics_event (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL,
    pet_id      UUID,
    event_type  VARCHAR(30) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata    JSONB NOT NULL DEFAULT '{}'::JSONB,
    CONSTRAINT analytics_event_type_check
        CHECK (event_type IN (
            'visit', 'application', 'message',
            'adoption', 'listing_published', 'registered'
        ))
);

ALTER TABLE analytics_event
    ADD CONSTRAINT fk_analytics_event_pet
    FOREIGN KEY (pet_id)
    REFERENCES pets_pet (id)
    ON DELETE SET NULL;

CREATE INDEX analytics_event_user_occurred_idx
    ON analytics_event (user_id, occurred_at DESC);

CREATE INDEX analytics_event_type_occurred_idx
    ON analytics_event (event_type, occurred_at DESC);
"""

SQL_DROP = "DROP TABLE IF EXISTS analytics_event;"


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0003_avatar_upload_path'),
        ('pets', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(SQL_CREATE, SQL_DROP),
    ]
