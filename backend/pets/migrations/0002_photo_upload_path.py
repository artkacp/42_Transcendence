import core.uploads
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pets', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='pet',
            name='photo',
            field=models.FileField(blank=True, null=True, upload_to=core.uploads.UploadTo('pets')),
        ),
    ]
