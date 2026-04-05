from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import WebhookData, AuctionItem
from .serializers import AuctionItemSerializer
from .auth import require_internal_secret
import requests
import json
import base64
import time
import string
import os

# n8n webhook URLs — set these in your environment variables
N8N_HIBID_WEBHOOK_URL = os.environ.get(
    'N8N_HIBID_WEBHOOK_URL',
    'https://sorcer.app.n8n.cloud/webhook/789023dc-a9bf-459c-8789-d9d0c993d1cb'
)
N8N_PHOTOGRAPHY_WEBHOOK_URL = os.environ.get(
    'N8N_PHOTOGRAPHY_WEBHOOK_URL',
    'https://sorcer.app.n8n.cloud/webhook/0be48928-c40c-4e16-a9f1-1e2fdf9ed9d2'
)

@api_view(['GET'])
def hello_world(request):
    return Response({
        'message': 'Hello from Django REST Framework!',
        'status': 'success'
    }, status=status.HTTP_200_OK)

@api_view(['POST'])
def test_post(request):
    data = request.data
    return Response({
        'message': 'Data received successfully!',
        'received_data': data,
        'status': 'success'
    }, status=status.HTTP_200_OK)

@api_view(['POST'])
def test_webhook_data(request):
    """Simple test endpoint to verify data is being received"""
    print("=== TEST WEBHOOK DATA ENDPOINT ===")
    print("Request data:", request.data)
    print("Request headers:", dict(request.headers))
    
    return Response({
        'message': 'Test endpoint working',
        'received_data': request.data,
        'headers': dict(request.headers),
        'status': 'success'
    }, status=status.HTTP_200_OK)

@api_view(['POST'])
@require_internal_secret
def call_webhook(request):
    """
    Call n8n webhook with URL data - now just sends data without expecting immediate response
    """
    try:
        url_main = request.data.get('url_main')
        if not url_main:
            return Response({
                'error': 'url_main is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        print("=== WEBHOOK CALL RECEIVED ===")
        print("Request data:", request.data)
        print("Request headers:", dict(request.headers))
        print("URL received:", url_main)
        
        webhook_url = N8N_HIBID_WEBHOOK_URL
        
        print("Calling n8n webhook:", webhook_url)
        
        # Prepare payload
        payload = {
            'url_main': url_main
        }
        
        print("Payload being sent:", payload)
        print("Making HTTP request to n8n...")
        
        # Send data to n8n webhook - don't wait for response content
        response = requests.post(webhook_url, json=payload, timeout=30)
        
        print("=== N8N WEBHOOK RESPONSE ===")
        print("Webhook Response Status:", response.status_code)
        print("Webhook Response Headers:", dict(response.headers))
        print("Webhook Response Body:", response.text)
        
        # Check if webhook was received successfully
        if response.status_code in [200, 201, 202]:
            print("=== WEBHOOK CALL COMPLETED ===")
            return Response({
                'message': 'URL sent to n8n for processing. Data will be available shortly.',
                'webhook_status': response.status_code,
                'status': 'processing',
                'note': 'Check the dashboard for processed data in a few moments'
            }, status=status.HTTP_200_OK)
        else:
            print("=== WEBHOOK CALL FAILED ===")
            return Response({
                'error': f'n8n webhook returned status {response.status_code}',
                'webhook_status': response.status_code,
                'status': 'failed'
            }, status=status.HTTP_400_BAD_REQUEST)
        
    except requests.RequestException as e:
        print("Webhook request failed:", str(e))
        return Response({
            'error': f'Webhook request failed: {str(e)}',
            'status': 'failed'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        print("Unexpected error:", str(e))
        return Response({
            'error': f'Unexpected error: {str(e)}',
            'status': 'failed'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@require_internal_secret
def submit_photography(request):
    try:
        # Extract all required parameters from request
        auction_name = request.data.get('auction_name', '')
        item_name = request.data.get('item_name', '')
        lot_number = request.data.get('lot_number', '')
        description = request.data.get('description', '')
        lead = request.data.get('lead', '')
        first_estimate = request.data.get('first_estimate', '')
        category = request.data.get('category', '')
        previous_ai_estimate = request.data.get('previous_ai_estimate', '')
        previous_ai_description = request.data.get('previous_ai_description', '')
        human_researcher_estimate = request.data.get('human_researcher_estimate', '')
        human_researcher_description = request.data.get('human_researcher_description', '')
        human_researcher_supporting_links = request.data.get('human_researcher_supporting_links', [])
        quantity = int(request.data.get('quantity', 1))
        photos = request.data.get('photos', [])

        webhook_url = N8N_PHOTOGRAPHY_WEBHOOK_URL

        # Generate SKU prefix from first letter of each of the first 3 words of auction_name and lot_number
        auction_words = [w for w in auction_name.split() if w.isalpha()]
        sku_prefix = ''.join([w[0].upper() for w in auction_words[:3]])
        sku_base = f"{sku_prefix}-{lot_number}"

        print(f"=== PHOTOGRAPHY WEBHOOK CALL ===")
        print(f"Webhook URL: {webhook_url}")
        print(f"Quantity: {quantity}")
        print(f"SKU Base: {sku_base}")

        # Prepare responses
        webhook_responses = []
        research2_items = []
        for i in range(quantity):
            sku = f"{sku_base}({string.ascii_lowercase[i]})"
            payload = {
                'auction_name': auction_name,
                'item_name': item_name,
                'lot_number': lot_number,
                'description': description,
                'lead': lead,
                'first_estimate': first_estimate,
                'category': category,
                'previous_ai_estimate': previous_ai_estimate,
                'previous_ai_description': previous_ai_description,
                'human_researcher_estimate': human_researcher_estimate,
                'human_researcher_description': human_researcher_description,
                'human_researcher_supporting_links': human_researcher_supporting_links,
                'quantity': 1,
                'sku': sku,
                'photos': photos
            }
            print(f"=== CALLING PHOTOGRAPHY WEBHOOK {i+1}/{quantity} ===")
            print(f"SKU: {sku}")
            print(f"Payload: {json.dumps(payload, indent=2)}")
            
            response = requests.post(webhook_url, json=payload)
            print(f"Photography Webhook Call {i+1}/{quantity} - SKU: {sku}")
            print("Status:", response.status_code)
            print("Body:", response.text)
            try:
                response_data = response.json()
            except json.JSONDecodeError:
                response_data = {'raw_response': response.text}
            webhook_responses.append({
                'sku': sku,
                'status': response.status_code,
                'response': response_data
            })
            # Create research2 item for frontend
            research2_item = {
                'id': f'{sku}-{int(time.time())}',
                'sku': sku,
                'auctionName': auction_name,
                'itemName': item_name,
                'lotNumber': lot_number,
                'description': description,
                'lead': lead,
                'auctionSiteEstimate': first_estimate,
                'category': category,
                'aiEstimate': previous_ai_estimate,
                'aiDescription': previous_ai_description,
                'researcherEstimate': human_researcher_estimate,
                'researcherDescription': human_researcher_description,
                'referenceUrls': human_researcher_supporting_links,
                'photographerQuantity': 1,
                'photographerImages': photos,
                'status': 'research2',
                'webhookResponse': response_data,
                'createdAt': int(time.time())
            }
            research2_items.append(research2_item)
            if i < quantity - 1:
                time.sleep(10)

        return Response({
            'message': f'Photography webhook called {quantity} times',
            'webhook_responses': webhook_responses,
            'research2_items': research2_items,
            'status': 'success'
        }, status=status.HTTP_200_OK)

    except requests.RequestException as e:
        print("Photography webhook request failed:", str(e))
        return Response({
            'error': f'Photography webhook request failed: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        print("Photography unexpected error:", str(e))
        return Response({
            'error': f'Photography unexpected error: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def receive_webhook_data(request):
    """
    Receive webhook data from n8n workflow and store it appropriately
    Handles both SKU-based data and HiBid URL processing data
    """
    try:
        data = request.data
        print("=== RECEIVED WEBHOOK DATA ===")
        print("Received webhook data:", json.dumps(data, indent=2))
        
        # Check if this is HiBid URL processing data
        if 'url_main' in data and 'hibid.com' in data.get('url_main', ''):
            print("Processing HiBid URL data...")
            return process_hibid_data(data)
        
        # Check if this is SKU-based data (existing functionality)
        elif 'sku' in data:
            print("Processing SKU-based data...")
            return process_sku_data(data)
        
        # Unknown data format
        else:
            print("Unknown webhook data format")
            return Response({
                'error': 'Unknown webhook data format. Expected either HiBid URL data or SKU-based data.',
                'received_data': data
            }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        print("Error processing webhook data:", str(e))
        return Response({
            'error': f'Error processing webhook data: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def process_hibid_data(data):
    """
    Process and store HiBid URL processing data
    """
    try:
        from .models import HiBidItem
        
        url_main = data.get('url_main')
        if not url_main:
            return Response({
                'error': 'url_main is required for HiBid data'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Extract data from the webhook response (matching n8n JSON structure)
        item_title = data.get('item_name', '')  # Use item_name as item_title
        lot_number = data.get('lot_number', '')
        description = data.get('description', '')
        lead = data.get('lead', '')
        item_name = data.get('item_name', '')
        category = data.get('category', '')
        estimate = data.get('estimate', '')
        auction_name = data.get('auction_name', '')
        auctioneer = data.get('auctioneer', '')
        auction_type = data.get('auction_type', '')
        auction_dates = data.get('auction_dates', '')
        location = data.get('location', '')
        current_bid = data.get('current_bid', '')
        bid_count = data.get('bid_count', 0)
        time_remaining = data.get('time_remaining', '')
        shipping_available = data.get('shipping_available', False)
        
        # Extract image URLs from n8n processing
        all_unique_image_urls = data.get('all_unique_image_urls', [])
        main_image_url = data.get('main_image_url', '')
        gallery_image_urls = data.get('gallery_image_urls', [])
        broad_search_images = data.get('broad_search_images', [])
        tumbnail_images = data.get('tumbnail_images', [])
        
        # Extract AI response
        ai_response = data.get('ai_response', '')
        
        print(f"Processing HiBid data for: {item_name} (Lot: {lot_number})")
        print(f"Images found: {len(all_unique_image_urls)} unique, {len(gallery_image_urls)} gallery")
        
        # Create or update HiBid item
        hibid_item, created = HiBidItem.objects.get_or_create(
            url_main=url_main,
            defaults={
                'item_title': item_title,
                'lot_number': lot_number,
                'description': description,
                'lead': lead,
                'item_name': item_name,
                'category': category,
                'estimate': estimate,
                'auction_name': auction_name,
                'auctioneer': auctioneer,
                'auction_type': auction_type,
                'auction_dates': auction_dates,
                'location': location,
                'current_bid': current_bid,
                'bid_count': bid_count,
                'time_remaining': time_remaining,
                'shipping_available': shipping_available,
                'all_unique_image_urls': all_unique_image_urls,
                'main_image_url': main_image_url,
                'gallery_image_urls': gallery_image_urls,
                'broad_search_images': broad_search_images,
                'tumbnail_images': tumbnail_images,
                'ai_response': ai_response,
                'raw_data': data,
                'status': 'processed'
            }
        )
        
        if not created:
            # Update existing record
            hibid_item.item_title = item_title or hibid_item.item_title
            hibid_item.lot_number = lot_number or hibid_item.lot_number
            hibid_item.description = description or hibid_item.description
            hibid_item.lead = lead or hibid_item.lead
            hibid_item.item_name = item_name or hibid_item.item_name
            hibid_item.category = category or hibid_item.category
            hibid_item.estimate = estimate or hibid_item.estimate
            hibid_item.auction_name = auction_name or hibid_item.auction_name
            hibid_item.auctioneer = auctioneer or hibid_item.auctioneer
            hibid_item.auction_type = auction_type or hibid_item.auction_type
            hibid_item.auction_dates = auction_dates or hibid_item.auction_dates
            hibid_item.location = location or hibid_item.location
            hibid_item.current_bid = current_bid or hibid_item.current_bid
            hibid_item.bid_count = bid_count or hibid_item.bid_count
            hibid_item.time_remaining = time_remaining or hibid_item.time_remaining
            hibid_item.shipping_available = shipping_available
            hibid_item.all_unique_image_urls = all_unique_image_urls or hibid_item.all_unique_image_urls
            hibid_item.main_image_url = main_image_url or hibid_item.main_image_url
            hibid_item.gallery_image_urls = gallery_image_urls or hibid_item.gallery_image_urls
            hibid_item.broad_search_images = broad_search_images or hibid_item.broad_search_images
            hibid_item.tumbnail_images = tumbnail_images or hibid_item.tumbnail_images
            hibid_item.ai_response = ai_response or hibid_item.ai_response
            hibid_item.raw_data = data
            hibid_item.status = 'processed'
            hibid_item.save()
        
        print(f"HiBid data {'created' if created else 'updated'} successfully")
        print(f"Item: {hibid_item.item_title or hibid_item.item_name}")
        print(f"Lot: {hibid_item.lot_number}")
        print(f"Status: {hibid_item.status}")
        
        return Response({
            'message': f'HiBid data {"created" if created else "updated"} successfully',
            'hibid_item': {
                'id': hibid_item.id,
                'url_main': hibid_item.url_main,
                'item_title': hibid_item.item_title,
                'item_name': hibid_item.item_name,
                'lot_number': hibid_item.lot_number,
                'source': hibid_item.source,
                'status': hibid_item.status,
                'estimate': hibid_item.estimate,
                'auction_name': hibid_item.auction_name,
                'main_image_url': hibid_item.main_image_url,
                'image_count': len(hibid_item.all_unique_image_urls),
                'processed_at': hibid_item.processed_at.isoformat()
            },
            'status': 'success'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        print("Error processing HiBid data:", str(e))
        return Response({
            'error': f'Error processing HiBid data: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def process_sku_data(data):
    """
    Process and store SKU-based webhook data (existing functionality)
    """
    try:
        from .models import WebhookData
        
        sku = data.get('sku')
        if not sku:
            return Response({
                'error': 'sku is required in webhook data'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if webhook data already exists for this SKU
        webhook_data, created = WebhookData.objects.get_or_create(
            sku=sku,
            defaults={
                'ebay_title': data.get('ebay_title', ''),
                'ebay_description': data.get('ebay_description', ''),
                'condition': data.get('condition', ''),
                'ai_improved_estimate': data.get('ai_improved_estimate', ''),
                'ai_improved_description': data.get('ai_improved_description', ''),
                'quantity': data.get('quantity', 1),
                'raw_data': data
            }
        )
        
        if not created:
            # Update existing record
            webhook_data.ebay_title = data.get('ebay_title', webhook_data.ebay_title)
            webhook_data.ebay_description = data.get('ebay_description', webhook_data.ebay_description)
            webhook_data.condition = data.get('condition', webhook_data.condition)
            webhook_data.ai_improved_estimate = data.get('ai_improved_estimate', webhook_data.ai_improved_estimate)
            webhook_data.ai_improved_description = data.get('ai_improved_description', webhook_data.ai_improved_description)
            webhook_data.quantity = data.get('quantity', webhook_data.quantity)
            webhook_data.raw_data = data
            webhook_data.save()
        
        return Response({
            'message': 'Webhook data received and stored successfully',
            'webhook_data': {
                'sku': webhook_data.sku,
                'ebay_title': webhook_data.ebay_title,
                'ebay_description': webhook_data.ebay_description,
                'condition': webhook_data.condition,
                'ai_improved_estimate': webhook_data.ai_improved_estimate,
                'ai_improved_description': webhook_data.ai_improved_description,
                'quantity': webhook_data.quantity,
                'received_at': webhook_data.received_at.isoformat()
            },
            'status': 'success'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        print("Error processing SKU data:", str(e))
        return Response({
            'error': f'Error processing SKU data: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@require_internal_secret
def get_webhook_data(request):
    """
    Get webhook data for a specific SKU
    """
    try:
        sku = request.query_params.get('sku')
        if not sku:
            return Response({
                'error': 'sku parameter is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            webhook_data = WebhookData.objects.get(sku=sku)
            return Response({
                'message': 'Webhook data retrieved successfully',
                'webhook_data': {
                    'sku': webhook_data.sku,
                    'ebay_title': webhook_data.ebay_title,
                    'ebay_description': webhook_data.ebay_description,
                    'condition': webhook_data.condition,
                    'ai_improved_estimate': webhook_data.ai_improved_estimate,
                    'ai_improved_description': webhook_data.ai_improved_description,
                    'quantity': webhook_data.quantity,
                    'received_at': webhook_data.received_at.isoformat()
                },
                'status': 'success'
            }, status=status.HTTP_200_OK)
        except WebhookData.DoesNotExist:
            return Response({
                'message': 'No webhook data found for this SKU',
                'webhook_data': None,
                'status': 'success'
            }, status=status.HTTP_200_OK)
        
    except Exception as e:
        print("Error retrieving webhook data:", str(e))
        return Response({
            'error': f'Error retrieving webhook data: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR) 

@api_view(['GET'])
@require_internal_secret
def get_hibid_items(request):
    """
    Get all processed HiBid items for the dashboard
    """
    try:
        from .models import HiBidItem
        
        # Get all HiBid items, ordered by most recent first
        hibid_items = HiBidItem.objects.filter(status='processed').order_by('-processed_at')
        
        # Convert to list for response
        items_data = []
        for item in hibid_items:
            items_data.append({
                'id': item.id,
                'url_main': item.url_main,
                'item_title': item.item_title or item.item_name,
                'item_name': item.item_name,
                'lot_number': item.lot_number,
                'description': item.description,
                'lead': item.lead,
                'category': item.category,
                'estimate': item.estimate,
                'auction_name': item.auction_name,
                'auctioneer': item.auctioneer,
                'auction_type': item.auction_type,
                'auction_dates': item.auction_dates,
                'location': item.location,
                'current_bid': item.current_bid,
                'bid_count': item.bid_count,
                'time_remaining': item.time_remaining,
                'shipping_available': item.shipping_available,
                'main_image_url': item.main_image_url,
                'image_count': len(item.all_unique_image_urls),
                'gallery_count': len(item.gallery_image_urls),
                'ai_response': item.ai_response,
                'status': item.status,
                'processed_at': item.processed_at.isoformat()
            })
        
        return Response({
            'message': f'Retrieved {len(items_data)} HiBid items successfully',
            'hibid_items': items_data,
            'total_count': len(items_data),
            'status': 'success'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        print("Error retrieving HiBid items:", str(e))
        return Response({
            'error': f'Error retrieving HiBid items: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ── Auction Items CRUD ────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@require_internal_secret
def auction_items(request):
    """List all auction items (optionally filtered by admin_id) or create one."""
    if request.method == 'GET':
        admin_id = request.query_params.get('adminId')
        queryset = AuctionItem.objects.all()
        if admin_id:
            queryset = queryset.filter(admin_id=admin_id)
        serializer = AuctionItemSerializer(queryset, many=True)
        return Response(serializer.data)

    # POST — create
    serializer = AuctionItemSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PATCH', 'DELETE'])
@require_internal_secret
def auction_item_detail(request, item_id):
    """Retrieve, update or delete a single auction item."""
    try:
        item = AuctionItem.objects.get(pk=item_id)
    except AuctionItem.DoesNotExist:
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(AuctionItemSerializer(item).data)

    if request.method == 'PATCH':
        serializer = AuctionItemSerializer(item, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # DELETE
    item.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)