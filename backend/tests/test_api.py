from datetime import timedelta

from app.core.security import create_token, password_fingerprint
from app.models import User

CUSTOMER = {"full_name": "Utilisateur Démo", "email": "demo@example.com", "phone": "0340000000"}
ADDRESS = {"line1": "12 rue des Jacarandas", "city": "Antananarivo", "postal_code": "101", "country": "Madagascar"}

CASQUE = "casque-audio-sans-fil-nomade"
HUB = "hub-usb-c-7-ports"
CARNET = "carnet-relie-a-la-main"
LOGO = "creation-de-logo"
DEVIS = "redaction-de-fiches-descriptives"
SEANCE = "seance-photo-portrait"
ATELIER = "atelier-decouverte-de-la-reliure"


def offer(client, ref):
    r = client.get(f"/api/offers/{ref}")
    assert r.status_code == 200, r.text
    return r.json()


def order(client, headers, items, **extra):
    body = {"items": items, "customer_info": CUSTOMER, **extra}
    return client.post("/api/orders", json=body, headers=headers)


def first_slot(client, offer_id):
    slots = client.get(f"/api/offers/{offer_id}/slots").json()
    assert slots, "le seed doit créer des créneaux"
    return slots[0]


# --- Auth -----------------------------------------------------------------


def test_health(client):
    assert client.get("/api/health").json()["status"] == "ok"


def test_register_login_refresh(client):
    body = {"email": "Nouveau@Test.com", "password": "motdepasse1", "full_name": "Nouvel Utilisateur"}
    r = client.post("/api/auth/register", json=body)
    assert r.status_code == 201
    assert r.json()["user"]["email"] == "nouveau@test.com"
    assert r.json()["user"]["role"] == "USER"

    assert client.post("/api/auth/register", json=body).status_code == 409
    bad = client.post("/api/auth/login", json={"email": "nouveau@test.com", "password": "mauvais-mdp"})
    assert bad.status_code == 401

    tokens = client.post("/api/auth/login", json={"email": "nouveau@test.com", "password": "motdepasse1"}).json()
    me = client.get("/api/users/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert me.status_code == 200 and me.json()["full_name"] == "Nouvel Utilisateur"
    assert client.get("/api/users/me").status_code == 401

    assert client.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 200
    # Un jeton d'accès n'est pas un jeton de rafraîchissement, et inversement.
    assert client.post("/api/auth/refresh", json={"refresh_token": tokens["access_token"]}).status_code == 401
    assert client.get("/api/users/me", headers={"Authorization": f"Bearer {tokens['refresh_token']}"}).status_code == 401


def test_register_rejects_short_password(client):
    r = client.post("/api/auth/register", json={"email": "a@b.co", "password": "court", "full_name": "Test"})
    assert r.status_code == 422


def test_password_reset_is_single_use(client, session_factory):
    with session_factory() as db:
        user = db.query(User).filter_by(email="demo@example.com").one()
        token = create_token(user.id, "reset", timedelta(minutes=5), {"pwd": password_fingerprint(user.hashed_password)})
    assert client.post("/api/auth/forgot-password", json={"email": "inconnu@test.com"}).status_code == 200
    ok = client.post("/api/auth/reset-password", json={"token": token, "new_password": "NouveauMdp456"})
    assert ok.status_code == 200
    again = client.post("/api/auth/reset-password", json={"token": token, "new_password": "AutreMdp789"})
    assert again.status_code == 400
    assert client.post("/api/auth/login", json={"email": "demo@example.com", "password": "NouveauMdp456"}).status_code == 200


def test_update_profile_and_password(client, demo_h):
    r = client.patch("/api/users/me", json={"full_name": "Démo Renommé"}, headers=demo_h)
    assert r.json()["full_name"] == "Démo Renommé"
    wrong = client.post("/api/users/me/password", json={"current_password": "faux", "new_password": "Nouveau1234"}, headers=demo_h)
    assert wrong.status_code == 400
    ok = client.post("/api/users/me/password", json={"current_password": "DemoPass123", "new_password": "Nouveau1234"}, headers=demo_h)
    assert ok.status_code == 200


# --- Catalogue ------------------------------------------------------------


def test_list_and_pagination(client):
    r = client.get("/api/offers", params={"page_size": 5}).json()
    assert r["total"] == 14 and r["pages"] == 3 and len(r["items"]) == 5
    assert {t["value"] for t in r["facets"]["types"]} == {"PHYSICAL_PRODUCT", "SERVICE", "DIGITAL_PRODUCT", "BOOKING"}
    assert len(r["facets"]["categories"]) == 7
    page3 = client.get("/api/offers", params={"page_size": 5, "page": 3}).json()
    assert len(page3["items"]) == 4
    assert client.get("/api/offers", params={"page_size": 500}).status_code == 422


def test_filters_and_sorting(client):
    services = client.get("/api/offers", params={"type": "SERVICE", "page_size": 48}).json()
    assert services["total"] == 4 and all(o["offer_type"] == "SERVICE" for o in services["items"])

    both = client.get("/api/offers", params={"type": ["SERVICE", "BOOKING"], "page_size": 48}).json()
    assert both["total"] == 8

    assert [o["slug"] for o in client.get("/api/offers", params={"q": "logo"}).json()["items"]][0] == LOGO
    assert client.get("/api/offers", params={"q": "zzzintrouvable"}).json()["total"] == 0
    assert client.get("/api/offers", params={"q": "100%"}).json()["total"] == 0  # pas de joker injecté

    assert client.get("/api/offers", params={"promo": True}).json()["total"] == 3
    stock = client.get("/api/offers", params={"in_stock": True, "page_size": 48}).json()
    assert CARNET not in [o["slug"] for o in stock["items"]]

    cheap = client.get("/api/offers", params={"max_price": 20, "page_size": 48}).json()
    assert cheap["total"] > 0 and all(o["price"] <= 20 for o in cheap["items"])

    asc = client.get("/api/offers", params={"sort": "price_asc", "page_size": 48}).json()["items"]
    prices = [o["price"] for o in asc if o["price"] is not None]
    assert prices == sorted(prices)
    assert asc[-1]["price"] is None  # l'offre sur devis passe en dernier

    photo = client.get("/api/offers", params={"category": "photo-image"}).json()
    assert photo["total"] == 2

    assert client.get("/api/offers", params={"sort": "n-importe-quoi"}).status_code == 422


def test_offer_detail_and_actions(client):
    casque = offer(client, CASQUE)
    assert casque["primary_action"] == "ADD_TO_CART" and casque["in_stock"] and casque["stock"] == 24
    assert offer(client, casque["id"])["slug"] == CASQUE  # par identifiant aussi

    assert offer(client, DEVIS)["primary_action"] == "REQUEST_QUOTE"
    assert offer(client, LOGO)["primary_action"] == "ORDER_SERVICE"
    assert offer(client, CARNET)["in_stock"] is False
    seance = offer(client, SEANCE)
    assert seance["primary_action"] == "BOOK" and seance["next_slot_at"] is not None
    assert client.get("/api/offers/n-existe-pas").status_code == 404


def test_slots_and_categories(client):
    seance = offer(client, SEANCE)
    slots = client.get(f"/api/offers/{seance['id']}/slots").json()
    assert slots and all(s["remaining"] >= 1 for s in slots)
    assert client.get(f"/api/offers/{offer(client, CASQUE)['id']}/slots").json() == []

    cats = client.get("/api/categories").json()
    assert len(cats) == 7 and sum(c["offer_count"] for c in cats) == 14
    assert client.get(f"/api/categories/{cats[0]['id']}").status_code == 200


# --- Commandes ------------------------------------------------------------


def test_order_requires_auth(client):
    r = client.post("/api/orders", json={"items": [{"offer_id": 1}], "customer_info": CUSTOMER})
    assert r.status_code == 401


def test_physical_order_totals_and_stock(client, demo_h):
    casque, hub = offer(client, CASQUE), offer(client, HUB)

    big = order(client, demo_h, [{"offer_id": casque["id"], "quantity": 2}], shipping_address=ADDRESS)
    assert big.status_code == 201, big.text
    body = big.json()
    assert body["subtotal"] == 158 and body["shipping_cost"] == 0 and body["total"] == 158
    assert body["status"] == "CONFIRMED" and body["payment_status"] == "PAID"
    assert body["items"][0]["line_total"] == 158 and body["items"][0]["offer_snapshot"]["title"].startswith("Casque")
    assert offer(client, CASQUE)["stock"] == 22

    small = order(client, demo_h, [{"offer_id": hub["id"]}], shipping_address=ADDRESS)
    assert small.json()["shipping_cost"] == 5 and small.json()["total"] == 44
    express = order(client, demo_h, [{"offer_id": hub["id"]}], shipping_address=ADDRESS, shipping_method="express")
    assert express.json()["shipping_cost"] == 12

    mine = client.get("/api/orders", headers=demo_h).json()
    assert mine["total"] == 3
    assert client.get(f"/api/orders/{body['id']}", headers=demo_h).status_code == 200


def test_order_validation_errors(client, demo_h):
    casque, carnet, devis, seance = (offer(client, s) for s in (CASQUE, CARNET, DEVIS, SEANCE))
    assert order(client, demo_h, [{"offer_id": casque["id"]}]).status_code == 400  # adresse manquante
    assert order(client, demo_h, [{"offer_id": carnet["id"]}], shipping_address=ADDRESS).status_code == 409  # rupture
    assert order(client, demo_h, [{"offer_id": casque["id"], "quantity": 999}], shipping_address=ADDRESS).status_code == 422
    over = order(client, demo_h, [{"offer_id": casque["id"], "quantity": 30}], shipping_address=ADDRESS)
    assert over.status_code == 409 and offer(client, CASQUE)["stock"] == 24  # rien n'est débité
    assert order(client, demo_h, [{"offer_id": devis["id"]}]).status_code == 400  # sur devis
    assert order(client, demo_h, [{"offer_id": seance["id"]}]).status_code == 400  # créneau manquant
    assert order(client, demo_h, [{"offer_id": 99999}]).status_code == 404


def test_service_and_digital_need_no_shipping(client, demo_h):
    logo = offer(client, LOGO)
    r = order(client, demo_h, [{"offer_id": logo["id"], "quantity": 2, "metadata": {"details": "Logo pour une boulangerie"}}])
    assert r.status_code == 201 and r.json()["shipping_cost"] == 0 and r.json()["total"] == 240
    assert r.json()["items"][0]["metadata"]["details"].startswith("Logo")

    icones = client.get("/api/offers", params={"type": "DIGITAL_PRODUCT"}).json()["items"][0]
    digital = order(client, demo_h, [{"offer_id": icones["id"], "quantity": 5}])
    assert digital.json()["items"][0]["quantity"] == 1  # un produit numérique = une unité
    refused = order(client, demo_h, [{"offer_id": icones["id"]}], payment_method="on_delivery")
    assert refused.status_code == 400


def test_booking_flow_and_capacity(client, demo_h, admin_h):
    seance = offer(client, SEANCE)
    slot = first_slot(client, seance["id"])
    r = order(client, demo_h, [{"offer_id": seance["id"], "slot_id": slot["id"], "metadata": {"notes": "Plutôt en extérieur"}}])
    assert r.status_code == 201, r.text

    bookings = client.get("/api/bookings", headers=demo_h).json()
    assert len(bookings) == 1 and bookings[0]["status"] == "PENDING" and bookings[0]["notes"] == "Plutôt en extérieur"

    # Capacité 1 : le même créneau n'est plus réservable
    again = order(client, demo_h, [{"offer_id": seance["id"], "slot_id": slot["id"]}])
    assert again.status_code == 409
    full = next(s for s in client.get(f"/api/offers/{seance['id']}/slots").json() if s["id"] == slot["id"])
    assert full["remaining"] == 0  # le créneau complet reste listé, marqué « complet »

    # Annulation par l'utilisateur : le créneau est libéré
    cancelled = client.post(f"/api/bookings/{bookings[0]['id']}/cancel", headers=demo_h)
    assert cancelled.status_code == 200 and cancelled.json()["status"] == "CANCELLED"
    assert client.post(f"/api/bookings/{bookings[0]['id']}/cancel", headers=demo_h).status_code == 409
    assert order(client, demo_h, [{"offer_id": seance["id"], "slot_id": slot["id"]}]).status_code == 201


def test_slot_from_another_offer_is_rejected(client, demo_h):
    seance, conseil = offer(client, SEANCE), offer(client, "consultation-conseil-en-strategie")
    slot = first_slot(client, conseil["id"])
    assert order(client, demo_h, [{"offer_id": seance["id"], "slot_id": slot["id"]}]).status_code == 400


def test_group_workshop_has_several_seats(client, demo_h):
    atelier = offer(client, ATELIER)
    slot = first_slot(client, atelier["id"])
    assert slot["capacity"] == 6
    for _ in range(6):
        assert order(client, demo_h, [{"offer_id": atelier["id"], "slot_id": slot["id"]}]).status_code == 201
    assert order(client, demo_h, [{"offer_id": atelier["id"], "slot_id": slot["id"]}]).status_code == 409


def test_cancel_order_restocks_and_frees_slots(client, demo_h):
    casque, seance = offer(client, CASQUE), offer(client, SEANCE)
    slot = first_slot(client, seance["id"])
    r = order(
        client, demo_h,
        [{"offer_id": casque["id"], "quantity": 3}, {"offer_id": seance["id"], "slot_id": slot["id"]}],
        shipping_address=ADDRESS,
    )
    assert r.status_code == 201 and offer(client, CASQUE)["stock"] == 21

    done = client.post(f"/api/orders/{r.json()['id']}/cancel", headers=demo_h)
    assert done.status_code == 200 and done.json()["status"] == "CANCELLED" and done.json()["payment_status"] == "REFUNDED"
    assert offer(client, CASQUE)["stock"] == 24
    assert client.get("/api/bookings", headers=demo_h).json()[0]["status"] == "CANCELLED"
    assert client.post(f"/api/orders/{r.json()['id']}/cancel", headers=demo_h).status_code == 409


def test_cannot_read_someone_elses_order(client, demo_h, admin_h):
    mine = order(client, demo_h, [{"offer_id": offer(client, LOGO)["id"]}]).json()
    assert client.get(f"/api/orders/{mine['id']}", headers=admin_h).status_code == 404
    assert client.get(f"/api/orders/{mine['id']}").status_code == 401


# --- Avis, favoris, devis, adresses --------------------------------------


def test_reviews_update_rating(client, demo_h):
    casque = offer(client, CASQUE)
    assert casque["rating_count"] == 2 and casque["rating_avg"] == 4.5

    r = client.post(f"/api/offers/{casque['id']}/reviews", json={"rating": 3, "comment": "Correct."}, headers=demo_h)
    assert r.status_code == 200 and r.json()["user_name"]
    after = offer(client, CASQUE)
    assert after["rating_count"] == 3 and after["rating_avg"] == 4.0

    client.post(f"/api/offers/{casque['id']}/reviews", json={"rating": 5, "comment": "Finalement top."}, headers=demo_h)
    assert offer(client, CASQUE)["rating_count"] == 3  # un seul avis par personne : il est remplacé

    listed = client.get(f"/api/offers/{casque['id']}/reviews").json()
    assert listed["total"] == 3
    mine = client.get("/api/users/me/reviews", headers=demo_h).json()
    assert len(mine) == 1 and mine[0]["offer_title"].startswith("Casque")

    assert client.delete(f"/api/reviews/{mine[0]['id']}", headers=demo_h).status_code == 204
    assert offer(client, CASQUE)["rating_count"] == 2
    assert client.post(f"/api/offers/{casque['id']}/reviews", json={"rating": 6}, headers=demo_h).status_code == 422
    assert client.post(f"/api/offers/{casque['id']}/reviews", json={"rating": 5}).status_code == 401
    assert client.get("/api/reviews/recent").json()


def test_favorites(client, demo_h):
    casque = offer(client, CASQUE)
    assert client.post(f"/api/favorites/{casque['id']}", headers=demo_h).status_code == 204
    assert client.post(f"/api/favorites/{casque['id']}", headers=demo_h).status_code == 204  # idempotent
    assert client.get("/api/favorites/ids", headers=demo_h).json() == [casque["id"]]
    assert [o["slug"] for o in client.get("/api/favorites", headers=demo_h).json()] == [CASQUE]
    assert client.delete(f"/api/favorites/{casque['id']}", headers=demo_h).status_code == 204
    assert client.get("/api/favorites/ids", headers=demo_h).json() == []
    assert client.get("/api/favorites").status_code == 401


def test_quote_request(client, demo_h, admin_h):
    devis = offer(client, DEVIS)
    short = client.post("/api/quote-requests", json={"offer_id": devis["id"], "message": "court"}, headers=demo_h)
    assert short.status_code == 422
    r = client.post(
        "/api/quote-requests",
        json={"offer_id": devis["id"], "message": "J'ai trente fiches produits à rédiger."},
        headers=demo_h,
    )
    assert r.status_code == 201 and r.json()["status"] == "NEW"
    assert len(client.get("/api/quote-requests", headers=demo_h).json()) == 1

    listed = client.get("/api/admin/quote-requests", headers=admin_h).json()
    assert listed[0]["user_email"] == "demo@example.com"
    done = client.patch(f"/api/admin/quote-requests/{listed[0]['id']}/status", json={"status": "ANSWERED"}, headers=admin_h)
    assert done.json()["status"] == "ANSWERED"


def test_addresses_default_switching(client, demo_h):
    a = client.post("/api/users/me/addresses", json={**ADDRESS, "label": "Maison"}, headers=demo_h).json()
    assert a["is_default"] is True  # la première adresse devient la principale
    b = client.post("/api/users/me/addresses", json={**ADDRESS, "label": "Bureau", "is_default": True}, headers=demo_h).json()
    listed = client.get("/api/users/me/addresses", headers=demo_h).json()
    assert [x["label"] for x in listed if x["is_default"]] == ["Bureau"]
    assert client.put(f"/api/users/me/addresses/{a['id']}", json={**ADDRESS, "label": "Maison 2"}, headers=demo_h).status_code == 200
    assert client.delete(f"/api/users/me/addresses/{b['id']}", headers=demo_h).status_code == 204
    assert client.delete(f"/api/users/me/addresses/{b['id']}", headers=demo_h).status_code == 404


# --- Administration ------------------------------------------------------


def test_admin_requires_admin_role(client, demo_h, admin_h):
    assert client.get("/api/admin/stats").status_code == 401
    assert client.get("/api/admin/stats", headers=demo_h).status_code == 403
    assert client.get("/api/admin/offers", headers=demo_h).status_code == 403
    assert client.post("/api/admin/offers", json={"title": "Pirate", "offer_type": "SERVICE", "price": 1}, headers=demo_h).status_code == 403
    stats = client.get("/api/admin/stats", headers=admin_h).json()
    assert stats["offers"]["total"] == 14 and stats["users"] >= 8


def test_admin_offer_lifecycle(client, admin_h):
    cat = client.get("/api/categories").json()[0]
    created = client.post(
        "/api/admin/offers",
        json={
            "title": "Impression d'affiches A2", "offer_type": "PHYSICAL_PRODUCT", "price": 12.5,
            "category_id": cat["id"], "physical": {"stock": 30, "weight_g": 150},
            "attributes": {"specs": {"Format": "A2"}},
        },
        headers=admin_h,
    )
    assert created.status_code == 201, created.text
    new = created.json()
    assert new["slug"] == "impression-d-affiches-a2" and new["is_active"] is False and new["stock"] == 30

    # Brouillon : invisible du public, visible de l'admin
    assert client.get(f"/api/offers/{new['slug']}").status_code == 404
    assert client.get("/api/admin/offers", params={"state": "draft"}, headers=admin_h).json()["total"] == 1
    assert client.get("/api/offers").json()["total"] == 14

    published = client.patch(f"/api/admin/offers/{new['id']}/status", json={"is_active": True}, headers=admin_h)
    assert published.json()["published_at"] is not None
    assert client.get("/api/offers").json()["total"] == 15

    updated = client.put(
        f"/api/admin/offers/{new['id']}",
        json={"price": 14, "old_price": 18, "is_featured": True, "physical": {"stock": 25}},
        headers=admin_h,
    ).json()
    assert updated["price"] == 14 and updated["stock"] == 25 and updated["slug"] == new["slug"]

    # Changer le type : un service n'a plus besoin de stock
    switched = client.put(f"/api/admin/offers/{new['id']}", json={"offer_type": "SERVICE"}, headers=admin_h).json()
    assert switched["primary_action"] == "ORDER_SERVICE"

    # Un prix est obligatoire sauf sur devis
    assert client.put(f"/api/admin/offers/{new['id']}", json={"price": None}, headers=admin_h).status_code == 422
    quote = client.put(f"/api/admin/offers/{new['id']}", json={"price": None, "price_mode": "QUOTE"}, headers=admin_h)
    assert quote.status_code == 200 and quote.json()["primary_action"] == "REQUEST_QUOTE"

    assert client.delete(f"/api/admin/offers/{new['id']}", headers=admin_h).status_code == 204
    assert client.get(f"/api/admin/offers/{new['id']}", headers=admin_h).status_code == 404


def test_admin_validation_and_delete_guard(client, demo_h, admin_h):
    assert client.post("/api/admin/offers", json={"title": "Sans prix", "offer_type": "SERVICE"}, headers=admin_h).status_code == 422
    assert client.post("/api/admin/offers", json={"title": "Prix négatif", "offer_type": "SERVICE", "price": -5}, headers=admin_h).status_code == 422
    assert client.post("/api/admin/offers", json={"title": "Cat inconnue", "offer_type": "SERVICE", "price": 5, "category_id": 9999}, headers=admin_h).status_code == 422
    twin1 = client.post("/api/admin/offers", json={"title": "Doublon", "offer_type": "SERVICE", "price": 5}, headers=admin_h).json()
    twin2 = client.post("/api/admin/offers", json={"title": "Doublon", "offer_type": "SERVICE", "price": 5}, headers=admin_h).json()
    assert twin1["slug"] == "doublon" and twin2["slug"] == "doublon-2"

    logo = offer(client, LOGO)
    order(client, demo_h, [{"offer_id": logo["id"]}])
    guarded = client.delete(f"/api/admin/offers/{logo['id']}", headers=admin_h)
    assert guarded.status_code == 409  # commandée : on dépublie, on ne supprime pas


def test_admin_slots(client, admin_h, demo_h):
    seance = offer(client, SEANCE)
    new = client.post(
        f"/api/admin/offers/{seance['id']}/slots",
        json={"starts_at": "2030-01-10T09:00:00Z", "ends_at": "2030-01-10T10:00:00Z", "capacity": 2},
        headers=admin_h,
    )
    assert new.status_code == 201 and new.json()["remaining"] == 2
    bad = client.post(
        f"/api/admin/offers/{seance['id']}/slots",
        json={"starts_at": "2030-01-10T10:00:00Z", "ends_at": "2030-01-10T09:00:00Z"},
        headers=admin_h,
    )
    assert bad.status_code == 422
    casque = offer(client, CASQUE)
    assert client.post(f"/api/admin/offers/{casque['id']}/slots", json={"starts_at": "2030-01-10T09:00:00Z", "ends_at": "2030-01-10T10:00:00Z"}, headers=admin_h).status_code == 400

    order(client, demo_h, [{"offer_id": seance["id"], "slot_id": new.json()["id"]}])
    assert client.delete(f"/api/admin/slots/{new.json()['id']}", headers=admin_h).status_code == 409


def test_admin_orders_and_bookings(client, demo_h, admin_h):
    casque, seance = offer(client, CASQUE), offer(client, SEANCE)
    slot = first_slot(client, seance["id"])
    placed = order(
        client, demo_h,
        [{"offer_id": casque["id"], "quantity": 2}, {"offer_id": seance["id"], "slot_id": slot["id"]}],
        shipping_address=ADDRESS,
    ).json()

    listed = client.get("/api/admin/orders", headers=admin_h).json()
    assert listed["total"] == 1 and listed["items"][0]["user_email"] == "demo@example.com"
    assert client.get("/api/admin/orders", params={"status": "SHIPPED"}, headers=admin_h).json()["total"] == 0

    shipped = client.patch(f"/api/admin/orders/{placed['id']}/status", json={"status": "SHIPPED"}, headers=admin_h)
    assert shipped.json()["status"] == "SHIPPED"
    assert client.post(f"/api/orders/{placed['id']}/cancel", headers=demo_h).status_code == 409  # déjà expédiée

    booking = client.get("/api/admin/bookings", headers=admin_h).json()["items"][0]
    assert booking["user_email"] == "demo@example.com"
    refused = client.patch(f"/api/admin/bookings/{booking['id']}/status", json={"status": "REFUSED"}, headers=admin_h)
    assert refused.json()["status"] == "REFUSED"
    # Refusée : le créneau est libéré, et elle ne peut pas être réactivée
    assert order(client, demo_h, [{"offer_id": seance["id"], "slot_id": slot["id"]}]).status_code == 201
    assert client.patch(f"/api/admin/bookings/{booking['id']}/status", json={"status": "ACCEPTED"}, headers=admin_h).status_code == 409

    cancelled = client.patch(f"/api/admin/orders/{placed['id']}/status", json={"status": "CANCELLED"}, headers=admin_h)
    assert cancelled.json()["status"] == "CANCELLED" and offer(client, CASQUE)["stock"] == 24
    assert client.patch(f"/api/admin/orders/{placed['id']}/status", json={"status": "CONFIRMED"}, headers=admin_h).status_code == 409


def test_admin_categories(client, admin_h):
    created = client.post("/api/admin/categories", json={"name": "Jardin & plantes", "applies_to": ["PHYSICAL_PRODUCT"]}, headers=admin_h)
    assert created.status_code == 201 and created.json()["slug"] == "jardin-plantes"
    cid = created.json()["id"]
    assert client.get(f"/api/categories/{cid}").status_code == 200
    renamed = client.put(f"/api/admin/categories/{cid}", json={"name": "Jardin", "slug": "jardin", "is_active": False}, headers=admin_h)
    assert renamed.json()["slug"] == "jardin"
    assert client.get(f"/api/categories/{cid}").status_code == 404  # inactive : invisible du public
    assert client.put(f"/api/admin/categories/{cid}", json={"name": "Jardin", "parent_id": cid}, headers=admin_h).status_code == 422

    logo_cat = offer(client, LOGO)["category"]["id"]
    assert client.delete(f"/api/admin/categories/{logo_cat}", headers=admin_h).status_code == 204
    assert offer(client, LOGO)["category"] is None  # l'offre reste, sans catégorie
    assert client.delete(f"/api/admin/categories/{logo_cat}", headers=admin_h).status_code == 404


def test_admin_users(client, admin_h, demo_h):
    users = client.get("/api/admin/users", headers=admin_h).json()
    demo = next(u for u in users["items"] if u["email"] == "demo@example.com")
    admin = next(u for u in users["items"] if u["email"] == "admin@example.com")
    assert client.patch(f"/api/admin/users/{admin['id']}", json={"role": "USER"}, headers=admin_h).status_code == 400
    promoted = client.patch(f"/api/admin/users/{demo['id']}", json={"role": "PROVIDER"}, headers=admin_h)
    assert promoted.json()["role"] == "PROVIDER"
    assert client.get("/api/admin/users", params={"q": "démo"}, headers=admin_h).json()["total"] == 1

    client.patch(f"/api/admin/users/{demo['id']}", json={"is_active": False}, headers=admin_h)
    assert client.get("/api/users/me", headers=demo_h).status_code == 401  # compte désactivé : jeton refusé
    assert client.post("/api/auth/login", json={"email": "demo@example.com", "password": "DemoPass123"}).status_code == 403


# --- Notifications --------------------------------------------------------


def notifs(client, headers, **params):
    r = client.get("/api/notifications", headers=headers, params=params)
    assert r.status_code == 200, r.text
    return r.json()


def test_notifications_require_login(client):
    assert client.get("/api/notifications").status_code == 401


def test_order_notifies_admin_then_status_change_notifies_customer(client, demo_h, admin_h):
    hub = offer(client, HUB)
    r = order(client, demo_h, [{"offer_id": hub["id"], "quantity": 1}], shipping_address=ADDRESS)
    assert r.status_code == 201, r.text
    order_id = r.json()["id"]

    admin_box = notifs(client, admin_h)
    assert admin_box["unread"] >= 1
    assert any(n["kind"] == "order_new" and str(order_id) in n["title"] for n in admin_box["items"])
    assert notifs(client, demo_h)["unread"] == 0  # l'auteur n'est pas notifié de sa propre action

    r = client.patch(f"/api/admin/orders/{order_id}/status", json={"status": "SHIPPED"}, headers=admin_h)
    assert r.status_code == 200, r.text
    mine = notifs(client, demo_h)
    assert mine["unread"] == 1
    assert "expédiée" in mine["items"][0]["title"]
    assert mine["items"][0]["link"] == f"/commande/confirmation/{order_id}"


def test_customer_cancel_and_quote_notify_admin(client, demo_h, admin_h):
    hub = offer(client, HUB)
    order_id = order(client, demo_h, [{"offer_id": hub["id"], "quantity": 1}], shipping_address=ADDRESS).json()["id"]
    assert client.post(f"/api/orders/{order_id}/cancel", headers=demo_h).status_code == 200
    quote = client.post(
        "/api/quote-requests",
        json={"offer_id": offer(client, DEVIS)["id"], "message": "Je voudrais un devis pour 20 fiches."},
        headers=demo_h,
    )
    assert quote.status_code == 201, quote.text
    kinds = {n["kind"] for n in notifs(client, admin_h)["items"]}
    assert {"order_new", "order_cancelled", "quote_new"} <= kinds

    r = client.patch(f"/api/admin/quote-requests/{quote.json()['id']}/status", json={"status": "ANSWERED"}, headers=admin_h)
    assert r.status_code == 200, r.text
    assert any(n["kind"] == "quote_status" for n in notifs(client, demo_h)["items"])


def test_booking_decision_notifies_customer(client, demo_h, admin_h):
    seance = offer(client, SEANCE)
    slot = first_slot(client, seance["id"])
    r = order(client, demo_h, [{"offer_id": seance["id"], "quantity": 1, "slot_id": slot["id"]}])
    assert r.status_code == 201, r.text
    booking = client.get("/api/bookings", headers=demo_h).json()[0]
    r = client.patch(f"/api/admin/bookings/{booking['id']}/status", json={"status": "ACCEPTED"}, headers=admin_h)
    assert r.status_code == 200, r.text
    assert any(n["kind"] == "booking_status" and "acceptée" in n["title"] for n in notifs(client, demo_h)["items"])


def test_register_notifies_admin(client, admin_h):
    before = notifs(client, admin_h)["unread"]
    r = client.post("/api/auth/register", json={"email": "nouveau@example.com", "password": "motdepasse123", "full_name": "Nouvel Arrivant"})
    assert r.status_code == 201, r.text
    after = notifs(client, admin_h)
    assert after["unread"] == before + 1
    assert after["items"][0]["kind"] == "user_new"


def test_mark_read_and_privacy(client, demo_h, admin_h):
    hub = offer(client, HUB)
    order(client, demo_h, [{"offer_id": hub["id"], "quantity": 1}], shipping_address=ADDRESS)
    first = notifs(client, admin_h)["items"][0]
    # un client ne peut pas toucher aux notifications d'un autre
    assert client.post(f"/api/notifications/{first['id']}/read", headers=demo_h).status_code == 404
    assert client.delete(f"/api/notifications/{first['id']}", headers=demo_h).status_code == 404
    assert client.post(f"/api/notifications/{first['id']}/read", headers=admin_h).status_code == 204
    assert notifs(client, admin_h, unread_only=True)["unread"] == notifs(client, admin_h)["unread"]
    assert client.post("/api/notifications/read-all", headers=admin_h).status_code == 204
    assert notifs(client, admin_h)["unread"] == 0
    assert client.delete(f"/api/notifications/{first['id']}", headers=admin_h).status_code == 204
