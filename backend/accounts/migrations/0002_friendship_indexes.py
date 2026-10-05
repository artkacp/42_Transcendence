from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='friendship',
            index=models.Index(
                fields=['addressee', 'status'],
                name='friendship_addressee_status_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='friendship',
            index=models.Index(
                fields=['requester', 'status'],
                name='friendship_requester_status_idx',
            ),
        ),
    ]
