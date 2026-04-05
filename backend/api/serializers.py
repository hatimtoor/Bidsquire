from rest_framework import serializers
from .models import AuctionItem, HiBidItem, WebhookData


class AuctionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuctionItem
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')


class HiBidItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = HiBidItem
        fields = '__all__'
        read_only_fields = ('processed_at',)


class WebhookDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebhookData
        fields = '__all__'
        read_only_fields = ('received_at',)
