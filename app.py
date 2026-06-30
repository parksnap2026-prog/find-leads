import os
import re
import json
import csv
import time
import threading
import requests
import concurrent.futures
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from email.utils import formatdate, make_msgid
import html as html_lib
from urllib.parse import urljoin, urlparse
from flask import Flask, render_template, jsonify, request, send_file
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.json.sort_keys = False   # preserve dict insertion order in JSON responses
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10 MB upload limit

# ── Mail config ───────────────────────────────────────────────
MAIL_SERVER   = os.getenv('MAIL_SERVER',   'mail.webpower.blog')
MAIL_SMTP     = int(os.getenv('MAIL_SMTP', '465'))
MAIL_USER     = os.getenv('MAIL_USER',     'business@webpower.blog')
MAIL_PASS     = os.getenv('MAIL_PASS',     'WebPower123@')
MAIL_FROM     = os.getenv('MAIL_FROM',     'WebPower Business')
# ─────────────────────────────────────────────────────────────

# Pre-built city list from GeoNames (instant, no API call needed)
_CITIES_FILE = os.path.join(os.path.dirname(__file__), 'data', 'cities.json')
_static_cities: dict = {}
if os.path.exists(_CITIES_FILE):
    with open(_CITIES_FILE, encoding='utf-8') as _f:
        _static_cities = json.load(_f)
    print(f'  Loaded city data for {len(_static_cities)} countries from {_CITIES_FILE}')

GOOGLE_API_KEY = os.getenv('GOOGLE_PLACES_API_KEY', '')

# ── Shared search history & logs ──────────────────────────────────────────────
_DATA_DIR         = os.path.join(os.path.dirname(__file__), 'data')
_HISTORY_FILE     = os.path.join(_DATA_DIR, 'search_history.json')
_CALL_LOG_FILE    = os.path.join(_DATA_DIR, 'call_log.json')
_EMAIL_LOG_CSV    = os.path.join(_DATA_DIR, 'email_log.csv')
_CALL_LOG_CSV     = os.path.join(_DATA_DIR, 'call_log.csv')

_history_lock     = threading.Lock()
_call_lock        = threading.Lock()
_email_csv_lock   = threading.Lock()
_call_csv_lock    = threading.Lock()

_EMAIL_CSV_HEADERS = ['Sent At', 'Business Name', 'Email Address', 'Template',
                      'Subject', 'City', 'Country', 'Business Type', 'Test/Real']
_CALL_CSV_HEADERS  = ['Called At', 'Action', 'Business Name', 'Business ID',
                      'Phone', 'City', 'Country']

def _read_json_file(path, default):
    try:
        if os.path.exists(path):
            with open(path, encoding='utf-8') as fh:
                return json.load(fh)
    except Exception:
        pass
    return default

def _write_json_file(path, data):
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)

def _append_csv(filepath, headers, row, lock):
    with lock:
        write_header = not os.path.exists(filepath) or os.path.getsize(filepath) == 0
        with open(filepath, 'a', newline='', encoding='utf-8-sig') as fh:
            writer = csv.writer(fh)
            if write_header:
                writer.writerow(headers)
            writer.writerow(row)

# ── Message templates ─────────────────────────────────────────────────────────
_TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), 'data', 'templates')
_TEMPLATES: list = []

def _load_message_templates():
    global _TEMPLATES
    order = ['create_build', 'update_maintain', 'ai_agent']
    loaded = {}
    for fname in os.listdir(_TEMPLATES_DIR):
        if fname.endswith('.json'):
            with open(os.path.join(_TEMPLATES_DIR, fname), encoding='utf-8') as fh:
                t = json.load(fh)
                loaded[t['id']] = t
    _TEMPLATES = [loaded[k] for k in order if k in loaded] + \
                 [v for k, v in loaded.items() if k not in order]
    print(f'  Loaded {len(_TEMPLATES)} message templates')

if os.path.isdir(_TEMPLATES_DIR):
    _load_message_templates()

# Maps each business_type key → template variant group
_TEMPLATE_CATEGORY = {
    'hair_salon':         'beauty',
    'beauty_salon':       'beauty',
    'nail_salon':         'beauty',
    'spa':                'beauty',
    'bakery':             'food_beverage',
    'restaurant':         'food_beverage',
    'cafe':               'food_beverage',
    'bar':                'food_beverage',
    'gym':                'health',
    'dentist':            'health',
    'doctor':             'health',
    'hospital':           'health',
    'veterinary_care':    'health',
    'pharmacy':           'health',
    'car_repair':         'automotive',
    'florist':            'retail',
    'pet_store':          'retail',
    'clothing_store':     'retail',
    'electronics_store':  'retail',
    'supermarket':        'retail',
    'furniture_store':    'retail',
    'hardware_store':     'retail',
    'laundry':            'retail',
    'real_estate_agency': 'professional',
    'travel_agency':      'professional',
    'accounting':         'professional',
    'lawyer':             'professional',
    'insurance_agency':   'professional',
    'hotel':              'hospitality',
    'school':             'education',
}

CHATBOT_SIGNATURES = {
    'Intercom':    ['intercom.io', 'intercomcdn.com', 'widget.intercom.io'],
    'Drift':       ['drift.com', 'js.driftt.com'],
    'Zendesk':     ['zopim.com', 'zendesk.com/embeddable', 'zd-messenger'],
    'Tidio':       ['tidiochat.com', 'widget.tidio.co', 'tidio.co'],
    'Crisp':       ['crisp.chat', 'client.crisp.chat'],
    'HubSpot':     ['js.hs-scripts.com', 'js.hubspot.com', 'hubspot.com/conversations'],
    'Freshchat':   ['wchat.freshchat.com', 'freshchat.com'],
    'Tawk.to':     ['embed.tawk.to', 'tawk.to'],
    'LiveChat':    ['livechatinc.com', 'cdn.livechat.com', 'livechat.com'],
    'Chatbot.com': ['cdn.chatbot.com'],
    'Landbot':     ['landbot.io', 'chats.landbot.io'],
    'ManyChat':    ['widget.manychat.com'],
    'Olark':       ['olark.com'],
    'Userlike':    ['userlike.com'],
    'Botpress':    ['botpress.com'],
    'Voiceflow':   ['cdn.voiceflow.com', 'runtime.voiceflow.com'],
    'Chaport':     ['chaport.com'],
    'JivoChat':    ['jivosite.com', 'jivo.chat'],
    'Smartsupp':   ['smartsupp.com'],
    'LiveAgent':   ['ladesk.com', 'liveagent.com'],
}

GENERIC_PATTERNS = [
    r'chatbot', r'live[\-_]?chat', r'chat[\-_]?widget',
    r'ai[\-_]assistant', r'virtual[\-_]assistant', r'support[\-_]chat',
]

EMAIL_RE = re.compile(r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b')

_EMAIL_BLOCK_LOCAL = frozenset({
    'noreply', 'no-reply', 'donotreply', 'do-not-reply',
    'mailer-daemon', 'postmaster', 'webmaster', 'bounce',
    'notifications', 'support', 'admin', 'root',
})
_EMAIL_BLOCK_DOMAIN = frozenset({
    'example.com', 'domain.com', 'yourdomain.com', 'email.com',
    'test.com', 'sentry.io', 'wixpress.com', 'squarespace.com',
    'amazonaws.com', 'googletagmanager.com',
})
_IMAGE_EXT_RE = re.compile(r'\.(png|jpe?g|gif|svg|webp|ico|bmp|tiff?)$', re.I)

_CONTACT_HREF_RE = re.compile(
    r'href=["\']([^"\']*(?:contact|about|reach|touch|info)[^"\']*)["\']', re.I
)


def _extract_emails(html):
    found = set()

    # Priority 1: explicit mailto: links (most reliable)
    for m in re.finditer(r'href=["\']mailto:([^\s"\'>\?&#]+)', html, re.I):
        found.add(m.group(1).strip().lower())

    # Priority 2: regex on visible text (strip tags to avoid CSS/JS false positives)
    text = re.sub(r'<[^>]+>', ' ', html)
    for m in EMAIL_RE.finditer(text):
        found.add(m.group(0).lower())

    clean = []
    for email in found:
        parts = email.split('@')
        if len(parts) != 2:
            continue
        local, domain = parts
        if not local or not domain or '.' not in domain:
            continue
        if _IMAGE_EXT_RE.search(domain):
            continue
        base_local = local.split('+')[0]   # strip + tags before blocklist check
        if base_local in _EMAIL_BLOCK_LOCAL:
            continue
        if domain in _EMAIL_BLOCK_DOMAIN:
            continue
        clean.append(email)

    return sorted(set(clean))[:5]


def _contact_page_url(html, base_url):
    parsed = urlparse(base_url)
    base_root = f"{parsed.scheme}://{parsed.netloc}"

    for m in _CONTACT_HREF_RE.finditer(html):
        href = m.group(1).strip()
        if not href or href.startswith('#') or href.startswith('mailto:') or href.startswith('tel:'):
            continue
        if href.startswith('http'):
            if urlparse(href).netloc == parsed.netloc:
                return href
        elif href.startswith('/'):
            return base_root + href
        else:
            candidate = urljoin(base_url, href)
            if urlparse(candidate).netloc == parsed.netloc:
                return candidate

    return None

BUSINESS_TYPES = {
    'all':                'All Business Types',
    'hair_salon':         'Hair Salon',
    'beauty_salon':       'Beauty Salon',
    'nail_salon':         'Nail Salon',
    'spa':                'Spa',
    'bakery':             'Bakery',
    'restaurant':         'Restaurant',
    'cafe':               'Cafe / Coffee Shop',
    'bar':                'Bar',
    'gym':                'Gym / Fitness',
    'dentist':            'Dentist',
    'doctor':             'Doctor / GP',
    'hospital':           'Hospital',
    'veterinary_care':    'Veterinarian',
    'pharmacy':           'Pharmacy',
    'car_repair':         'Auto Repair',
    'florist':            'Florist',
    'pet_store':          'Pet Store',
    'clothing_store':     'Clothing Store',
    'electronics_store':  'Electronics Store',
    'supermarket':        'Supermarket',
    'furniture_store':    'Furniture Store',
    'hardware_store':     'Hardware Store',
    'laundry':            'Laundry',
    'real_estate_agency': 'Real Estate Agency',
    'travel_agency':      'Travel Agency',
    'accounting':         'Accounting',
    'lawyer':             'Lawyer',
    'insurance_agency':   'Insurance Agency',
    'hotel':              'Hotel',
    'school':             'School',
}

OSM_TAGS = {
    'hair_salon':         [('shop', 'hairdresser'), ('shop', 'hair'),
                           ('amenity', 'hairdresser')],
    'beauty_salon':       [('shop', 'beauty'), ('shop', 'cosmetics'),
                           ('shop', 'makeup'), ('amenity', 'beauty_salon')],
    'nail_salon':         [('shop', 'nail_salon'), ('shop', 'nails')],
    'spa':                [('leisure', 'spa'), ('amenity', 'spa'),
                           ('amenity', 'massage'), ('leisure', 'sauna')],
    'bakery':             [('shop', 'bakery'), ('craft', 'bakery'),
                           ('shop', 'pastry'), ('shop', 'confectionery'),
                           ('shop', 'bread')],
    'restaurant':         [('amenity', 'restaurant'), ('amenity', 'fast_food'),
                           ('amenity', 'food_court')],
    'cafe':               [('amenity', 'cafe'), ('amenity', 'coffee_shop'),
                           ('shop', 'coffee'), ('shop', 'tea')],
    'bar':                [('amenity', 'bar'), ('amenity', 'pub'),
                           ('amenity', 'nightclub'), ('amenity', 'biergarten')],
    'gym':                [('leisure', 'fitness_centre'), ('amenity', 'gym'),
                           ('leisure', 'sports_centre'), ('leisure', 'sports_hall'),
                           ('leisure', 'swimming_pool')],
    'dentist':            [('amenity', 'dentist'), ('healthcare', 'dentist'),
                           ('healthcare:speciality', 'dentistry')],
    'doctor':             [('amenity', 'doctors'), ('healthcare', 'doctor'),
                           ('amenity', 'clinic'), ('healthcare', 'clinic'),
                           ('amenity', 'health_centre')],
    'hospital':           [('amenity', 'hospital'), ('healthcare', 'hospital')],
    'veterinary_care':    [('amenity', 'veterinary'), ('healthcare', 'veterinary'),
                           ('shop', 'veterinary')],
    'pharmacy':           [('amenity', 'pharmacy'), ('healthcare', 'pharmacy'),
                           ('shop', 'chemist'), ('shop', 'drugstore')],
    'car_repair':         [('shop', 'car_repair'), ('amenity', 'car_repair'),
                           ('shop', 'tyres'), ('shop', 'car_parts'),
                           ('craft', 'car_repair')],
    'florist':            [('shop', 'florist'), ('shop', 'flowers')],
    'pet_store':          [('shop', 'pet'), ('shop', 'aquarium'),
                           ('shop', 'pet_grooming'), ('amenity', 'pet_store')],
    'clothing_store':     [('shop', 'clothes'), ('shop', 'fashion'),
                           ('shop', 'boutique'), ('shop', 'second_hand'),
                           ('shop', 'shoes'), ('shop', 'accessories')],
    'electronics_store':  [('shop', 'electronics'), ('shop', 'computer'),
                           ('shop', 'mobile_phone'), ('shop', 'appliance'),
                           ('shop', 'hifi'), ('shop', 'radiotechnics')],
    'supermarket':        [('shop', 'supermarket'), ('shop', 'grocery'),
                           ('shop', 'convenience'), ('shop', 'general'),
                           ('shop', 'wholesale')],
    'furniture_store':    [('shop', 'furniture'), ('shop', 'interior_decoration'),
                           ('shop', 'houseware'), ('shop', 'antiques'),
                           ('shop', 'bed')],
    'hardware_store':     [('shop', 'hardware'), ('shop', 'doityourself'),
                           ('shop', 'tools'), ('shop', 'building_materials'),
                           ('shop', 'paint')],
    'laundry':            [('shop', 'laundry'), ('amenity', 'laundry'),
                           ('shop', 'dry_cleaning'), ('amenity', 'dry_cleaning')],
    'real_estate_agency': [('office', 'real_estate'), ('office', 'estate_agent'),
                           ('amenity', 'real_estate_agency')],
    'travel_agency':      [('shop', 'travel_agency'), ('office', 'travel_agent'),
                           ('amenity', 'travel_agency')],
    'accounting':         [('office', 'accountant'), ('office', 'tax_advisor'),
                           ('office', 'financial'), ('office', 'financial_advisor')],
    'lawyer':             [('office', 'lawyer'), ('office', 'legal'),
                           ('office', 'notary'), ('office', 'attorney')],
    'insurance_agency':   [('office', 'insurance'), ('office', 'insurance_agency')],
    'hotel':              [('tourism', 'hotel'), ('tourism', 'motel'),
                           ('tourism', 'guest_house'), ('tourism', 'hostel'),
                           ('amenity', 'hotel')],
    'school':             [('amenity', 'school'), ('amenity', 'college'),
                           ('amenity', 'university'), ('amenity', 'kindergarten'),
                           ('amenity', 'language_school'), ('amenity', 'driving_school')],
}

HEADERS = {
    'User-Agent': 'BusinessFinderApp/1.0 (local research tool)',
    'Accept-Language': 'en-US,en;q=0.9',
}


def geocode_city(city, country_code):
    url = 'https://nominatim.openstreetmap.org/search'
    params = {
        'city':    city,
        'country': country_code,
        'format':  'json',
        'limit':   1,
    }
    try:
        r = requests.get(url, params=params, headers=HEADERS, timeout=10)
        data = r.json()
        if data:
            return float(data[0]['lat']), float(data[0]['lon'])
        return None, None
    except Exception:
        return None, None


def fetch_cities_for_country(country_code):
    code = country_code.upper()

    # Fast path: use pre-built GeoNames data (instant)
    if code in _static_cities:
        return _static_cities[code], None

    # Fallback: query Overpass for countries not in the bundled dataset
    query = f"""
[out:json][timeout:60];
area["ISO3166-1:alpha2"="{code}"]->.c;
(
  node["place"="city"](area.c);
  node["place"="town"](area.c);
);
out tags;
"""
    for attempt in range(3):
        try:
            r = requests.post(
                'https://overpass-api.de/api/interpreter',
                data={'data': query},
                headers=HEADERS,
                timeout=65,
            )
            if r.status_code == 429 or not r.text.strip():
                time.sleep(3 + attempt * 3)
                continue
            elements = r.json().get('elements', [])
            break
        except Exception as e:
            if attempt == 2:
                return [], str(e)
            time.sleep(3)
    else:
        return [], 'Overpass API unavailable'

    cities = sorted(
        {el['tags']['name'] for el in elements if el.get('tags', {}).get('name')},
        key=lambda s: s.lower(),
    )
    return cities, None


def search_overpass(business_type, lat, lon, radius_m=5000):
    if business_type == 'all':
        # nwr = node + way + relation; covers all OSM element types
        tq = [
            f'nwr["{key}"]["name"](around:{radius_m},{lat},{lon});'
            for key in ('shop', 'amenity', 'office', 'leisure', 'tourism', 'craft')
        ]
        query = f'[out:json][timeout:90][maxsize:67108864];({"".join(tq)});out center tags 2000;'
        req_timeout = 100
    else:
        tags = OSM_TAGS.get(business_type, [('amenity', 'restaurant')])
        tag_queries = [
            f'nwr["{key}"="{value}"](around:{radius_m},{lat},{lon});'
            for key, value in tags
        ]
        query = f'[out:json][timeout:30];({"".join(tag_queries)});out center tags;'
        req_timeout = 35

    for attempt in range(3):
        try:
            r = requests.post(
                'https://overpass-api.de/api/interpreter',
                data={'data': query},
                headers=HEADERS,
                timeout=req_timeout,
            )
            if r.status_code == 429 or not r.text.strip():
                time.sleep(3 + attempt * 3)
                continue
            try:
                data = r.json()
            except ValueError:
                # Overpass returned an HTML error page
                time.sleep(2 + attempt * 2)
                continue
            elements = data.get('elements', [])
            if not elements and data.get('remark'):
                return [], data['remark']
            break
        except Exception as e:
            if attempt == 2:
                return [], str(e)
            time.sleep(2 + attempt * 2)
    else:
        return [], 'Overpass API unavailable — try again in a few seconds'

    results = []
    for el in elements:
        t = el.get('tags', {})
        name = t.get('name', '').strip()
        if not name:
            continue

        addr_parts = []
        housenumber = t.get('addr:housenumber', '')
        street      = t.get('addr:street', '')
        city        = t.get('addr:city', '')
        postcode    = t.get('addr:postcode', '')
        if street:
            addr_parts.append((housenumber + ' ' + street).strip())
        if city:
            addr_parts.append(city)
        if postcode:
            addr_parts.append(postcode)

        phone   = t.get('phone') or t.get('contact:phone') or t.get('telephone') or ''
        website = t.get('website') or t.get('contact:website') or t.get('url') or ''

        if website and not website.startswith('http'):
            website = 'https://' + website

        results.append({
            'id':      str(el.get('id', '')),
            'name':    name,
            'address': ', '.join(addr_parts) or 'Address not listed',
            'phone':   phone,
            'website': website,
            'email':   t.get('email') or t.get('contact:email') or '',
            'opening_hours': t.get('opening_hours', ''),
        })

    return results, None


def search_google(business_label, city, country, page_token=None):
    if not GOOGLE_API_KEY:
        return [], None, 'Google API key not set'

    base = 'https://maps.googleapis.com/maps/api/place/textsearch/json'
    if page_token:
        params = {'pagetoken': page_token, 'key': GOOGLE_API_KEY}
    else:
        params = {'query': f'{business_label} in {city} {country}', 'key': GOOGLE_API_KEY}

    try:
        r = requests.get(base, params=params, timeout=12)
        data = r.json()
    except Exception as e:
        return [], None, str(e)

    def get_details(place_id):
        url = 'https://maps.googleapis.com/maps/api/place/details/json'
        p = {
            'place_id': place_id,
            'fields': 'formatted_phone_number,international_phone_number,website',
            'key': GOOGLE_API_KEY,
        }
        try:
            rd = requests.get(url, params=p, timeout=10).json().get('result', {})
            return {
                'phone':   rd.get('formatted_phone_number') or rd.get('international_phone_number', ''),
                'website': rd.get('website', ''),
            }
        except Exception:
            return {'phone': '', 'website': ''}

    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        futures = {ex.submit(get_details, p['place_id']): p for p in data.get('results', [])}
        for fut, place in futures.items():
            det = fut.result()
            results.append({
                'id':      place.get('place_id', ''),
                'name':    place.get('name', ''),
                'address': place.get('formatted_address', ''),
                'phone':   det['phone'],
                'website': det['website'],
                'email':   '',
                'opening_hours': '',
            })

    return results, data.get('next_page_token'), None


_SCRAPE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}

# When crawling a Facebook page, the externalhit UA causes FB to serve its
# Open Graph / crawler-friendly HTML instead of a JS login wall.
_FB_HEADERS = {
    'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}

_SOCIAL_DOMAINS = frozenset({
    'facebook.com', 'fb.com', 'instagram.com', 'twitter.com',
    'x.com', 'linkedin.com', 'tiktok.com', 'youtube.com',
})

_SKIP_DIRS = frozenset({
    'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
    'linkedin.com', 'youtube.com', 'tiktok.com',
    'tripadvisor.com', 'tripadvisor.co.uk', 'yelp.com', 'yell.com',
    'opentable.com', 'squaremeal.co.uk', 'hardens.com',
    'timeout.com', 'timeout.co.uk', 'thefork.com',
    'designmynight.com', 'restaurantguru.com', 'booknbook.uk',
    'cafe-restaurant-bar.uk', 'enprimeurclub.com',
    'zomato.com', 'happycow.net', 'zagat.com',
    'grubhub.com', 'doordash.com', 'ubereats.com',
    'seamless.com', 'postmates.com', 'caviar.com',
    'deliveroo.co.uk', 'justeat.co.uk', 'just-eat.co.uk',
    'menustic.com', 'allmenus.com', 'menupix.com',
    'menu.com', 'locu.com', 'eat24.com',
    'zmenu.com', 'restaurantji.com', 'restaurantjump.com',
    'restaurantedroop.com', 'hereyoueat.com', 'whereyoueat.com',
    'slice.com', 'beyondmenu.com', 'sirved.com',
    'google.com', 'maps.google.com', 'duckduckgo.com',
    'wikipedia.org', 'wikidata.org', 'openstreetmap.org',
    'foursquare.com', 'trustpilot.com', 'checkatrade.com',
    'booking.com', 'expedia.com', 'airbnb.com',
    'yellowpages.com', 'whitepages.com', 'mapquest.com',
    'chamberofcommerce.com', 'manta.com', 'bbb.org',
})


def _guess_website_url(name, city=''):
    """Try predictable URL patterns. Returns first URL whose title matches the business name."""
    words = name.split()

    # Build variants: first 2 words, first 3 words, single word as fallback
    variants = []
    if len(words) >= 2:
        variants.append(' '.join(words[:2]))
    if len(words) >= 3:
        variants.append(' '.join(words[:3]))
    if len(words) == 1:
        variants.append(name)

    # Base must-words from the business name
    must_words = [w.lower() for w in words[:2] if len(w) > 2]
    # For single-word names, also require the city in the title (avoids wrong brand matches)
    if len(words) == 1 and city:
        must_words.append(city.lower())

    for variant in variants:
        slug  = re.sub(r'[^a-z0-9]+', '-', variant.lower()).strip('-')
        plain = slug.replace('-', '')
        # Collect candidates that exist (HEAD check only — fast)
        hits = []
        for url in [
            f'https://www.{slug}.com',
            f'https://{slug}.com',
            f'https://www.{plain}.com',
            f'https://www.{slug}.co.uk',
            f'https://www.{slug}.co',
            f'https://www.{slug}.net',
        ]:
            try:
                head = requests.head(url, headers=_SCRAPE_HEADERS, timeout=4,
                                     allow_redirects=True)
                if head.status_code < 404:
                    hits.append(head.url.rstrip('/'))
            except Exception:
                pass

        # Verify each candidate: accept if title matches must_words
        for final in hits:
            try:
                # Domain-exact-match shortcut: if domain == plain name, it's the chain website
                host_slug  = re.sub(r'[^a-z0-9]', '',
                    urlparse(final).netloc.lower().lstrip('www.').split('.')[0])
                name_slug  = re.sub(r'[^a-z0-9]', '', variant.lower().split()[0])
                name_words = [w.lower() for w in variant.split() if len(w) > 2]
                if host_slug == name_slug:
                    # Domain exactly matches business name — do a quick title check
                    # using only the name words (not city), to accept national chains
                    get_quick = _fetch_url(final, _SCRAPE_HEADERS)
                    tm_q = re.search(r'<title[^>]*>(.*?)</title>', get_quick.text, re.I | re.S)
                    ttl  = (tm_q.group(1) if tm_q else '').lower()
                    if all(w in ttl for w in name_words):
                        return final
                    continue  # domain matched but wrong brand (e.g. spire.com ≠ spire restaurant)

                get = _fetch_url(final, _SCRAPE_HEADERS)
                tm  = re.search(r'<title[^>]*>(.*?)</title>', get.text, re.I | re.S)
                og  = re.search(r'og:title[^>]+content=["\']([^"\']+)', get.text, re.I)
                title_text = ((tm.group(1) if tm else '') + ' ' +
                              (og.group(1) if og else '')).lower()
                if all(w in title_text for w in must_words):
                    return final
            except Exception:
                pass
    return ''


def _is_social(url):
    try:
        host = urlparse(url).netloc.lower().lstrip('www.')
        return any(host == d or host.endswith('.' + d) for d in _SOCIAL_DOMAINS)
    except Exception:
        return False


def _extract_page_name(html):
    """Extract the business name from page metadata, best source first."""
    # JSON-LD name field
    for m in re.finditer(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html, re.I | re.S,
    ):
        try:
            data = json.loads(m.group(1))
            items = data if isinstance(data, list) else [data]
            for item in items:
                if isinstance(item, dict) and item.get('name'):
                    return str(item['name']).strip()
        except (ValueError, TypeError):
            pass

    # og:site_name (cleaner than og:title which often has suffix text)
    m = re.search(
        r'<meta[^>]+property=["\']og:site_name["\'][^>]+content=["\']([^"\']+)["\']',
        html, re.I,
    )
    if m:
        return m.group(1).strip()

    # og:title
    m = re.search(
        r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']',
        html, re.I,
    )
    if m:
        return m.group(1).strip()

    # <title> tag as last resort
    m = re.search(r'<title[^>]*>([^<]+)</title>', html, re.I)
    if m:
        return m.group(1).strip()

    return ''


def _extract_phones(html):
    """Extract phone numbers from tel: href links."""
    phones = set()
    for m in re.finditer(r'href=["\']tel:([^\s"\'>\?&#]+)', html, re.I):
        raw = m.group(1).strip().replace('%20', ' ').replace('%2B', '+')
        digits = re.sub(r'\D', '', raw)
        if 7 <= len(digits) <= 15:
            phones.add(raw)
    return sorted(phones)[:3]


def _extract_jsonld_contacts(html):
    """Extract phone / email from JSON-LD <script> blocks (highest-quality source)."""
    contacts = {}
    for m in re.finditer(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html, re.I | re.S,
    ):
        try:
            data = json.loads(m.group(1))
            items = data if isinstance(data, list) else [data]
            for item in items:
                if not isinstance(item, dict):
                    continue
                if item.get('telephone') and 'phone' not in contacts:
                    contacts['phone'] = str(item['telephone'])
                if item.get('email') and 'email' not in contacts:
                    contacts['email'] = str(item['email']).lower()
        except (ValueError, TypeError):
            pass
    return contacts


_CLOUDFLARE_SIGNALS = {'just a moment', 'checking your browser', 'enable javascript and cookies'}

def _fetch_url(url, headers):
    """Fetch URL; if Cloudflare blocks, retry with cloudscraper."""
    r = requests.get(url, headers=headers, timeout=12, allow_redirects=True)
    snippet = r.text[:600].lower()
    if r.status_code in (403, 503) or any(s in snippet for s in _CLOUDFLARE_SIGNALS):
        try:
            import cloudscraper
            cs = cloudscraper.create_scraper(browser={'browser': 'chrome', 'platform': 'windows'})
            r = cs.get(url, timeout=20)
        except Exception:
            pass
    return r


def scrape_website(url):
    """Fetch a business website, extract emails + phones, detect live-chat agents."""
    empty = {'has_agent': False, 'platforms': [], 'emails': [], 'phones': [],
             'name': '', 'checked': False, 'is_social': False, 'error': 'No website'}
    if not url:
        return empty

    if not url.startswith('http'):
        url = 'https://' + url

    social = _is_social(url)
    is_fb  = 'facebook.com' in url or 'fb.com' in url
    hdrs   = _FB_HEADERS if is_fb else _SCRAPE_HEADERS

    try:
        r = _fetch_url(url, hdrs)
        html      = r.text
        final_url = r.url
    except requests.exceptions.Timeout:
        return {**empty, 'checked': True, 'is_social': social, 'error': 'Timeout'}
    except Exception as e:
        return {**empty, 'checked': True, 'is_social': social, 'error': str(e)[:80]}

    html_lower = html.lower()
    page_name  = _extract_page_name(html)

    # ── Chatbot / live-chat detection (not meaningful on social media pages) ──
    found_agents = []
    if not social:
        for platform, sigs in CHATBOT_SIGNATURES.items():
            if any(s.lower() in html_lower for s in sigs):
                found_agents.append(platform)
        if not found_agents:
            for pat in GENERIC_PATTERNS:
                if re.search(pat, html_lower):
                    found_agents.append('Chat Widget')
                    break

    # ── Structured data (JSON-LD) — most reliable for phone + email ──
    jsonld = _extract_jsonld_contacts(html)

    # ── Emails ──
    emails = set(_extract_emails(html))
    if jsonld.get('email'):
        emails.add(jsonld['email'])

    # ── Phones ──
    phones = set(_extract_phones(html))
    if jsonld.get('phone'):
        phones.add(jsonld['phone'])

    # ── Follow contact page when data is still sparse ──
    if not social and (len(emails) < 2 or not phones):
        contact_url = _contact_page_url(html, final_url)
        if contact_url and contact_url.rstrip('/') != final_url.rstrip('/'):
            try:
                rc = requests.get(contact_url, headers=_SCRAPE_HEADERS, timeout=10, allow_redirects=True)
                emails.update(_extract_emails(rc.text))
                phones.update(_extract_phones(rc.text))
                cld = _extract_jsonld_contacts(rc.text)
                if cld.get('email'):
                    emails.add(cld['email'])
                if cld.get('phone'):
                    phones.add(cld['phone'])
            except Exception:
                pass

    return {
        'has_agent': bool(found_agents),
        'platforms': list(set(found_agents)),
        'emails':    sorted(emails)[:5],
        'phones':    sorted(phones)[:3],
        'name':      page_name,
        'checked':   True,
        'is_social': social,
        'error':     None,
    }


@app.route('/')
def index():
    return render_template('index.html', business_types=BUSINESS_TYPES)


@app.route('/api/config')
def config():
    return jsonify({
        'has_google_key': bool(GOOGLE_API_KEY),
        'business_types': BUSINESS_TYPES,
    })


@app.route('/api/set-key', methods=['POST'])
def set_key():
    global GOOGLE_API_KEY
    key = (request.json or {}).get('api_key', '').strip()
    if key:
        GOOGLE_API_KEY = key
        return jsonify({'ok': True})
    return jsonify({'error': 'Empty key'}), 400


@app.route('/api/cities/<country_code>')
def cities(country_code):
    result, err = fetch_cities_for_country(country_code)
    if err and not result:
        return jsonify({'error': err}), 500
    return jsonify(result)


@app.route('/api/search', methods=['POST'])
def search():
    body        = request.json or {}
    country     = body.get('country', '').strip()
    city        = body.get('city', '').strip()
    btype       = body.get('business_type', 'hair_salon')
    page_token  = body.get('page_token')
    radius      = int(body.get('radius', 5000))
    source_pref = body.get('source', 'auto')

    if not country or not city:
        return jsonify({'error': 'country and city are required'}), 400

    label        = BUSINESS_TYPES.get(btype, btype)
    use_google   = source_pref == 'google' and bool(GOOGLE_API_KEY)
    search_label = 'businesses' if btype == 'all' else label

    if use_google:
        all_results, next_token, err = search_google(search_label, city, country, page_token)
        source      = 'google'
        radius_used = None
    else:
        lat, lon = geocode_city(city, country)
        if lat is None:
            return jsonify({'error': f'Could not locate "{city}" in "{country}"'}), 400
        all_results, err = search_overpass(btype, lat, lon, radius)
        source      = 'openstreetmap'
        next_token  = None
        radius_used = radius

        # Auto-expand when OSM returns nothing — small / rural cities often need a
        # wider net because OSM coverage is thinner outside major urban areas.
        if not all_results and not err:
            for expanded in (radius * 3, 30000):
                expanded = min(expanded, 30000)
                if expanded <= radius_used:
                    continue
                wider, werr = search_overpass(btype, lat, lon, expanded)
                if wider:
                    all_results = wider
                    radius_used = expanded
                    err = None
                    break
                if werr:
                    err = werr

    if err and not all_results:
        return jsonify({'error': err}), 500

    return jsonify({
        'results':     all_results,
        'total':       len(all_results),
        'source':      source,
        'radius_used': radius_used,   # km shown in UI when auto-expanded
    })


@app.route('/api/check-agent', methods=['POST'])
def check_agent():
    url = (request.json or {}).get('url', '')
    return jsonify(scrape_website(url))


@app.route('/api/check-agents-batch', methods=['POST'])
def check_agents_batch():
    urls = (request.json or {}).get('urls', [])
    out  = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
        fmap = {ex.submit(scrape_website, u): u for u in urls if u}
        for fut, u in fmap.items():
            try:
                out[u] = fut.result()
            except Exception as e:
                out[u] = {'has_agent': False, 'platforms': [], 'emails': [], 'checked': True, 'error': str(e)}
    return jsonify(out)


@app.route('/api/templates')
def get_templates():
    return jsonify([
        {k: v for k, v in t.items() if k != 'variants'}
        for t in _TEMPLATES
    ])


@app.route('/api/compose', methods=['POST'])
def compose_message():
    body          = request.json or {}
    template_id   = body.get('template_id', '')
    business_name = (body.get('name') or '').strip() or 'your business'
    business_type = body.get('business_type', '')
    city          = (body.get('city') or '').strip() or 'your city'
    type_label    = BUSINESS_TYPES.get(business_type, business_type).lower()

    tpl = next((t for t in _TEMPLATES if t['id'] == template_id), None)
    if not tpl:
        return jsonify({'error': 'Template not found'}), 404

    category = _TEMPLATE_CATEGORY.get(business_type, 'default')
    # Specific business-type variant takes priority over the category group
    variant  = (tpl.get('variants', {}).get(business_type) or
                tpl.get('variants', {}).get(category) or
                tpl.get('default', {}))

    def fill(text):
        return (text
            .replace('{{NAME}}', business_name)
            .replace('{{CITY}}', city)
            .replace('{{TYPE}}', type_label)
            .replace('[Your Name]', MAIL_FROM)
            .replace('[Your Company]', 'WebPower')
            .replace('[Your Phone] | [Your Email]', MAIL_USER)
            .replace('[Your Email]', MAIL_USER)
            .replace('[Your Phone]', ''))

    return jsonify({
        'subject': fill(variant.get('subject', '')),
        'body':    fill(variant.get('body', '')),
    })


@app.route('/api/find-by-query', methods=['POST'])
def find_by_query():
    """Find a business by name/address text — tries Google Places then DuckDuckGo."""
    query = (request.json or {}).get('query', '').strip()
    if not query:
        return jsonify({'error': 'Query is required'}), 400

    website = ''
    name_hint = ''
    address_hint = ''
    phone_hint = ''

    # ── 1. Google Places "Find Place" (best quality, needs API key) ──
    if GOOGLE_API_KEY:
        try:
            r = requests.get(
                'https://maps.googleapis.com/maps/api/place/findplacefromtext/json',
                params={
                    'input': query,
                    'inputtype': 'textquery',
                    'fields': 'name,formatted_address,website,formatted_phone_number,international_phone_number',
                    'key': GOOGLE_API_KEY,
                },
                headers=HEADERS, timeout=10,
            )
            cands = r.json().get('candidates', [])
            if cands:
                p = cands[0]
                website      = p.get('website', '')
                name_hint    = p.get('name', '')
                address_hint = p.get('formatted_address', '')
                phone_hint   = p.get('formatted_phone_number') or p.get('international_phone_number', '')
        except Exception:
            pass

    # ── 2. Pattern guessing (fast, no external service) ─────────────
    if not website:
        parts     = [p.strip() for p in query.split(',')]
        biz_name  = name_hint or parts[0]
        # Extract a city-like word from later parts (alpha-only, length > 3, not generic)
        _skip_geo = {'road','street','avenue','lane','drive','united','kingdom',
                     'states','the','and','new','north','south','east','west',
                     'church','park','hill','grove','close','place','court',
                     'gardens','square','crescent','terrace','way','walk',
                     'high','main','bridge','mill','green','cross','gate',
                     'ring','market','castle','mount','vale','view','rise'}
        # Skip parts that are purely numeric (house numbers, postcodes)
        city_hint = next((
            w for p in parts[1:] for w in p.split()
            if w.isalpha() and len(w) > 3 and w.lower() not in _skip_geo
        ), '')
        website  = _guess_website_url(biz_name, city=city_hint)

    # ── 3. DuckDuckGo Lite (last resort, may be rate-limited) ────────
    if not website:
        import time, random
        time.sleep(random.uniform(0.5, 1.5))
        try:
            r = requests.post(
                'https://lite.duckduckgo.com/lite/',
                data={'q': query},
                headers={
                    **_SCRAPE_HEADERS,
                    'User-Agent': random.choice([
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
                        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/123 Safari/537.36',
                        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
                    ]),
                    'Content-Type':  'application/x-www-form-urlencoded',
                    'Referer':       'https://lite.duckduckgo.com/lite/',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                timeout=12,
            )
            if r.status_code == 200 and len(r.text) > 5000:
                first_word = re.sub(r'\W', '', query.split()[0]).lower()
                candidates = []
                for m in re.finditer(r'<a[^>]+href="(https?://[^"]+)"', r.text):
                    url  = m.group(1).split('?')[0].rstrip('/')
                    host = urlparse(url).netloc.lower().lstrip('www.')
                    if any(host == s or host.endswith('.' + s) for s in _SKIP_DIRS):
                        continue
                    score = 2 if first_word in host.replace('-','').replace('.','') else 1
                    candidates.append((score, url))
                    if len(candidates) >= 10:
                        break
                if candidates:
                    candidates.sort(key=lambda x: -x[0])
                    website = candidates[0][1]
        except Exception:
            pass

    if not website:
        return jsonify({'error': f'No website found for "{query}" — try pasting the URL directly'}), 404

    scraped  = scrape_website(website)
    safe_id  = 'found-' + re.sub(r'\W+', '-', query)[:40].strip('-')

    _BAD_NAMES = {'just a moment', 'access denied', '403 forbidden',
                  '404 not found', 'attention required', 'loading', 'cloudflare'}
    raw_name = scraped.get('name', '')
    good_name = (
        name_hint
        or (raw_name if raw_name.lower() not in _BAD_NAMES and len(raw_name) < 120 else '')
        or query.split(',')[0].strip()
    )

    return jsonify({
        'id':            safe_id,
        'name':          good_name,
        'address':       address_hint or 'Address not listed',
        'phone':         phone_hint or (scraped['phones'][0] if scraped.get('phones') else ''),
        'website':       website,
        'email':         scraped['emails'][0] if scraped.get('emails') else '',
        'opening_hours': '',
        'agent_data':    scraped,
    })


@app.route('/api/fetch-business', methods=['POST'])
def fetch_business():
    """Scrape a business website/Facebook page by URL and return a result row."""
    url = (request.json or {}).get('url', '').strip()
    if not url:
        return jsonify({'error': 'URL is required'}), 400
    if not url.startswith('http'):
        url = 'https://' + url

    scraped = scrape_website(url)
    if scraped.get('error') and not scraped.get('phones') and not scraped.get('emails'):
        return jsonify({'error': scraped['error']}), 502

    safe_id = 'manual-' + re.sub(r'\W+', '-', url)[:50].strip('-')

    _BAD = {'just a moment', 'access denied', '403 forbidden',
            '404 not found', 'attention required', 'loading', 'cloudflare'}
    raw_name = scraped.get('name', '')
    clean_name = raw_name if raw_name and raw_name.lower() not in _BAD else ''

    from urllib.parse import urlparse as _up
    hostname = _up(url).netloc.lstrip('www.')

    return jsonify({
        'id':            safe_id,
        'name':          clean_name or hostname,
        'address':       'Address not listed',
        'phone':         scraped['phones'][0] if scraped.get('phones') else '',
        'website':       url,
        'email':         scraped['emails'][0] if scraped.get('emails') else '',
        'opening_hours': '',
        'agent_data':    scraped,
    })


@app.route('/templates')
def templates_page():
    return render_template('templates.html')


@app.route('/history')
def history_page():
    return render_template('history.html')


@app.route('/api/history', methods=['GET'])
def get_history():
    with _history_lock:
        data = _read_json_file(_HISTORY_FILE, [])
    return jsonify(data)


@app.route('/api/history', methods=['POST'])
def add_history():
    entry = request.json or {}
    with _history_lock:
        data = _read_json_file(_HISTORY_FILE, [])
        data.insert(0, entry)
        if len(data) > 500:
            data = data[:500]
        _write_json_file(_HISTORY_FILE, data)
    return jsonify({'ok': True})


@app.route('/api/history/delete', methods=['POST'])
def delete_history_entry():
    entry_id = (request.json or {}).get('id')
    with _history_lock:
        data = _read_json_file(_HISTORY_FILE, [])
        data = [e for e in data if e.get('id') != entry_id]
        _write_json_file(_HISTORY_FILE, data)
    return jsonify({'ok': True})


@app.route('/api/history/replace', methods=['POST'])
def replace_history():
    entries = request.json if isinstance(request.json, list) else []
    with _history_lock:
        _write_json_file(_HISTORY_FILE, entries)
    return jsonify({'ok': True})


@app.route('/api/call-log', methods=['GET'])
def get_call_log():
    with _call_lock:
        data = _read_json_file(_CALL_LOG_FILE, {})
    return jsonify(data)


@app.route('/api/call-log', methods=['POST'])
def update_call_log():
    body = request.json or {}
    biz_id = body.get('id', '').strip()
    if not biz_id:
        return jsonify({'error': 'id required'}), 400
    called     = bool(body.get('called'))
    called_at  = body.get('calledAt', '')
    biz_name   = body.get('name', '')
    phone      = body.get('phone', '')
    city       = body.get('city', '')
    country    = body.get('country', '')
    with _call_lock:
        data = _read_json_file(_CALL_LOG_FILE, {})
        if called:
            data[biz_id] = {
                'called':   True,
                'calledAt': called_at,
                'name':     biz_name,
                'phone':    phone,
                'city':     city,
                'country':  country,
            }
        else:
            data.pop(biz_id, None)
        _write_json_file(_CALL_LOG_FILE, data)
    from datetime import datetime as _dt
    _append_csv(_CALL_LOG_CSV, _CALL_CSV_HEADERS, [
        _dt.now().strftime('%Y-%m-%d %H:%M:%S'),
        'Called' if called else 'Uncalled',
        biz_name,
        biz_id,
        phone,
        city,
        country,
    ], _call_csv_lock)
    return jsonify({'ok': True})


@app.route('/api/templates/full')
def get_templates_full():
    return jsonify(_TEMPLATES)


@app.route('/api/templates/<template_id>', methods=['POST'])
def save_template(template_id):
    body = request.json or {}
    path = os.path.join(_TEMPLATES_DIR, f'{template_id}.json')
    if not os.path.exists(path):
        return jsonify({'error': 'Template not found'}), 404
    with open(path, encoding='utf-8') as fh:
        data = json.load(fh)
    # Update default subject/body; variant subjects/bodies if provided
    if 'subject' in body:
        data['default']['subject'] = body['subject']
    if 'body' in body:
        data['default']['body'] = body['body']
    if 'variants' in body:
        data.setdefault('variants', {})
        for variant_key, variant_data in body['variants'].items():
            if variant_key not in data['variants']:
                data['variants'][variant_key] = {}
            if 'subject' in variant_data:
                data['variants'][variant_key]['subject'] = variant_data['subject']
            if 'body' in variant_data:
                data['variants'][variant_key]['body'] = variant_data['body']
    if body.get('delete_variant'):
        data.get('variants', {}).pop(body['delete_variant'], None)
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
    _load_message_templates()
    return jsonify({'ok': True})


@app.route('/mailer')
def mailer():
    return render_template('mailer.html')


@app.route('/api/send-mail', methods=['POST'])
def send_mail():
    to_raw      = request.form.get('to', '').strip()
    subject     = request.form.get('subject', '').strip()
    body        = request.form.get('body', '').strip()
    biz_name    = request.form.get('biz_name', '').strip()
    template    = request.form.get('template', '').strip()
    city        = request.form.get('city', '').strip()
    country     = request.form.get('country', '').strip()
    biz_type    = request.form.get('biz_type', '').strip()
    is_test     = request.form.get('is_test', 'false').strip().lower() == 'true'

    if not to_raw or not subject or not body:
        return jsonify({'error': 'to, subject and body are required'}), 400

    recipients = [e.strip() for e in re.split(r'[,;\n]+', to_raw) if e.strip()]
    if not recipients:
        return jsonify({'error': 'No valid recipients'}), 400

    attachments = [f for f in request.files.getlist('attachments') if f and f.filename]
    is_html     = body.lstrip().startswith('<')

    # Logo path for CID inline attachment
    _LOGO_PATH = os.path.join(os.path.dirname(__file__), 'static', 'logoWebPower.png')

    def plain_from_html(html_str):
        """Strip tags to produce a readable plain-text fallback."""
        txt = re.sub(r'<br\s*/?>', '\n', html_str, flags=re.I)
        txt = re.sub(r'</p>', '\n\n', txt, flags=re.I)
        txt = re.sub(r'<[^>]+>', '', txt)
        import html as _h
        return _h.unescape(txt).strip()

    def build_html(text):
        blocks = []
        for para in text.split('\n\n'):
            lines = [l for l in para.split('\n') if l.strip()]
            if not lines:
                continue
            if all(l.strip().startswith('•') for l in lines):
                items = ''.join(
                    f'<li style="margin-bottom:4px">{html_lib.escape(l.lstrip("•").strip())}</li>'
                    for l in lines
                )
                blocks.append(f'<ul style="padding-left:20px;margin:10px 0">{items}</ul>')
            else:
                content = '<br>'.join(html_lib.escape(l) for l in lines)
                blocks.append(f'<p style="margin:0 0 12px">{content}</p>')
        return '\n'.join(blocks)

    results = {}
    ctx = ssl.create_default_context()
    try:
        conn = smtplib.SMTP_SSL(MAIL_SERVER, MAIL_SMTP, context=ctx, timeout=15)
        conn.login(MAIL_USER, MAIL_PASS)
    except Exception as e:
        return jsonify({'error': f'SMTP connection failed: {e}'}), 500

    with conn:
        for addr in recipients:
            try:
                outer = MIMEMultipart('mixed') if attachments else MIMEMultipart('alternative')
                outer['From']       = f'{MAIL_FROM} <{MAIL_USER}>'
                outer['To']         = addr
                outer['Reply-To']   = MAIL_USER
                outer['Subject']    = subject
                outer['Date']       = formatdate(localtime=True)
                outer['Message-ID'] = make_msgid(domain='webpower.blog')

                if is_html:
                    # HTML template with CID logo
                    plain_text = plain_from_html(body)
                    plain_part = MIMEText(plain_text, 'plain', 'utf-8')

                    related = MIMEMultipart('related')
                    related.attach(MIMEText(body, 'html', 'utf-8'))
                    if os.path.exists(_LOGO_PATH):
                        with open(_LOGO_PATH, 'rb') as lf:
                            logo_part = MIMEBase('image', 'png')
                            logo_part.set_payload(lf.read())
                            encoders.encode_base64(logo_part)
                            logo_part.add_header('Content-ID', '<logo_webpower>')
                            logo_part.add_header('Content-Disposition', 'inline', filename='logo.png')
                            related.attach(logo_part)

                    alt = MIMEMultipart('alternative')
                    alt.attach(plain_part)
                    alt.attach(related)

                    if attachments:
                        outer.attach(alt)
                    else:
                        # Swap outer to mixed so we can nest alt inside
                        outer = MIMEMultipart('mixed')
                        outer['From']       = f'{MAIL_FROM} <{MAIL_USER}>'
                        outer['To']         = addr
                        outer['Reply-To']   = MAIL_USER
                        outer['Subject']    = subject
                        outer['Date']       = formatdate(localtime=True)
                        outer['Message-ID'] = make_msgid(domain='webpower.blog')
                        outer.attach(alt)
                else:
                    # Plain text → convert to HTML wrapper
                    html_content = (
                        f'<!DOCTYPE html><html><head><meta charset="UTF-8">'
                        f'<meta name="viewport" content="width=device-width,initial-scale=1"></head>'
                        f'<body style="margin:0;padding:0;background:#f4f4f4">'
                        f'<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0">'
                        f'<tr><td align="center"><table width="600" cellpadding="0" cellspacing="0"'
                        f' style="background:#fff;border-radius:8px;padding:32px;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#222">'
                        f'<tr><td>{build_html(body)}</td></tr></table></td></tr></table></body></html>'
                    )
                    if attachments:
                        alt = MIMEMultipart('alternative')
                        alt.attach(MIMEText(body, 'plain', 'utf-8'))
                        alt.attach(MIMEText(html_content, 'html', 'utf-8'))
                        outer.attach(alt)
                    else:
                        outer.attach(MIMEText(body, 'plain', 'utf-8'))
                        outer.attach(MIMEText(html_content, 'html', 'utf-8'))

                if attachments:
                    for f in attachments:
                        f.seek(0)
                        part = MIMEBase('application', 'octet-stream')
                        part.set_payload(f.read())
                        encoders.encode_base64(part)
                        part.add_header('Content-Disposition', 'attachment', filename=f.filename)
                        outer.attach(part)

                msg = outer

                conn.sendmail(MAIL_USER, addr, outer.as_string())
                results[addr] = 'sent'
                from datetime import datetime as _dt
                _append_csv(_EMAIL_LOG_CSV, _EMAIL_CSV_HEADERS, [
                    _dt.now().strftime('%Y-%m-%d %H:%M:%S'),
                    biz_name,
                    addr,
                    template,
                    subject,
                    city,
                    country,
                    biz_type,
                    'Test' if is_test else 'Real',
                ], _email_csv_lock)
            except Exception as e:
                results[addr] = f'error: {e}'

    failed = [a for a, r in results.items() if r != 'sent']
    if failed:
        return jsonify({'results': results, 'error': f'Failed: {", ".join(failed)}'}), 500
    return jsonify({'results': results, 'ok': True})


@app.route('/activity')
def activity_page():
    return render_template('activity.html')


@app.route('/api/activity/emails')
def activity_emails():
    if not os.path.exists(_EMAIL_LOG_CSV):
        return jsonify([])
    with open(_EMAIL_LOG_CSV, encoding='utf-8-sig', newline='') as fh:
        reader = csv.DictReader(fh)
        rows = list(reader)
    rows.reverse()  # newest first
    return jsonify(rows)


@app.route('/api/activity/calls')
def activity_calls():
    if not os.path.exists(_CALL_LOG_CSV):
        return jsonify([])
    with open(_CALL_LOG_CSV, encoding='utf-8-sig', newline='') as fh:
        reader = csv.DictReader(fh)
        rows = list(reader)
    rows.reverse()  # newest first
    return jsonify(rows)


@app.route('/api/export/email-log')
def export_email_log():
    if not os.path.exists(_EMAIL_LOG_CSV):
        return jsonify({'error': 'No email log yet'}), 404
    return send_file(_EMAIL_LOG_CSV, as_attachment=True,
                     download_name='webpower_email_log.csv', mimetype='text/csv')


@app.route('/api/export/call-log')
def export_call_log_csv():
    if not os.path.exists(_CALL_LOG_CSV):
        return jsonify({'error': 'No call log yet'}), 404
    return send_file(_CALL_LOG_CSV, as_attachment=True,
                     download_name='webpower_call_log.csv', mimetype='text/csv')


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5050))
    print(f'\n  Business Finder running at  http://localhost:{port}\n')
    app.run(debug=False, port=port, host='0.0.0.0')
