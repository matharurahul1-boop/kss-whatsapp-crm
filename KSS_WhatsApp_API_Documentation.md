# KSS Interiors — WhatsApp Notification API

Base URL: `https://kss-whatsapp-crm.vercel.app`

Your software calls one endpoint per event. When the call succeeds, the app sends the matching WhatsApp template message.

---

## 1. Authentication

Every request must carry an API key as a Bearer token:

```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

- Keys are issued from the app (**API Integration** page) and are shown only once when created.
- Keep the key on your server. Never put it in browser/front-end code or in a URL.
- A key can be revoked at any time from the same page; create a new one if it is lost or exposed.

## 2. Rate limit

60 requests per minute per API key. Above that you receive `429 RATE_LIMITED`.

## 3. Calling a trigger

```
POST /api/v1/triggers/{slug}
```

### Request body

| Field | Type | Required | Description |
|---|---|---|---|
| `phone` | string | customer triggers | Customer phone. Country code optional for Indian numbers: `9876543210` and `919876543210` both work |
| `name` | string | customer triggers | Customer name. Fills template variable `{{1}}` |
| `variables` | object | see below | Template variables keyed by number: `{"2": "...", "3": "..."}` |
| `adminPhones` | string or array | admin triggers (optional) | WhatsApp numbers to notify. Omit to use the admin numbers saved in the app |
| `salesManagerPhones` | string or array | sales manager trigger (optional) | WhatsApp numbers to notify. Omit to use the sales manager numbers saved in the app |
| `test` | boolean | optional | Test mode, see section 5 |

**Every field can be sent in the JSON body or as a URL parameter**, for example
`POST /api/v1/triggers/sales-order?phone=9876543210&name=Rahul&v2=SO-1024`.
`v1`, `v2`, `v3`... are the template variable numbers. URL parameters win over the body.

**Shortcut names for contact details.** All contact details use the same format, `Name: Number`, and are passed per request (nothing is hardcoded in the app):

| Trigger | Shortcuts (body or URL) |
|---|---|
| `enquiry-created` | `product` (= `v2`), `contact1` to `contact5` (= `v3` to `v7`) |
| `pi-created` | `project` (= `v2`), `contact1` (= `v3`) |
| `ticket-open` | `concern` (= `v2`), `ticket` (= `v3`), `contact1` (= `v4`) |
| `order-dispatched` | `order` (= `v2`), `dispatchDate` (= `v3`), `contact1` (= `v4`) |

**Contact lines you do not send are filled in by the app.** The app takes the **team contact numbers saved in the app (Settings > Team Contacts, up to 5)**, in the format `Name: Number`. PI Created, Ticket Opened and Order Dispatched put **all** of them, separated by commas, into their one contact variable (`{{3}}` for PI Created, `{{4}}` for Ticket Opened and Order Dispatched). You do not need to send contact details at all. Anything you do send (`contact1`...) is used instead. Enquiry Created lines that remain empty are delivered as `N/A`. To skip the automatic filling and get `N/A`, send `contacts=none`.

Every other template variable must have a value. If any is missing the API answers `400 MISSING_VARIABLES` and lists which ones, without sending anything.

### Example

```bash
curl -X POST "https://kss-whatsapp-crm.vercel.app/api/v1/triggers/enquiry-created" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "919876543210",
    "name": "Rahul Sharma",
    "product": "Modular Kitchen"
  }'
```

The same call with URL parameters only:

```
POST /api/v1/triggers/enquiry-created?phone=9876543210&name=Rahul&product=Modular%20Kitchen
```

The KSS contact names and numbers are part of the Enquiry Created template text, so they are not sent.

### Success response

```json
{
  "success": true,
  "data": { "fired": true, "messageId": "wamid.XXXX", "templateName": "proforma_invoice_created_customer", "phone": "919876543210" }
}
```

### Not sent (trigger switched off)

HTTP 200 with `fired: false` — nothing is sent:

```json
{ "success": true, "data": { "fired": false, "reason": "Trigger is disabled or has no template assigned. Enable it in Settings → Triggers." } }
```

For admin and sales manager triggers, `fired: false` is also returned when no user of that role has a WhatsApp number saved.

## 4. Endpoints

All are `POST https://kss-whatsapp-crm.vercel.app/api/v1/triggers/{slug}`.

### Customer notifications (sent to `phone`)

| # | Event | Slug | `variables` to send |
|---|---|---|---|
| 1 | Enquiry Created | `enquiry-created` | `product` (or `2`), `contact1`–`contact5` (or `3`–`7`), "Name: Number" format. Unused contact lines become `N/A` |
| 2 | PI Created | `pi-created` | `project` (or `2`), `contact1` (or `3`), "Name: Number" format |
| 3 | Sales Order | `sales-order` | `2` sales order number |
| 4 | Service Request (first service reminder) | `service-request` | `2` sales order number |
| 5 | Ticket Opened | `ticket-open` | `concern` (or `2`), `ticket` (or `3`), `contact1` (or `4`), "Name: Number" format |
| 6 | Ticket Closed | `ticket-closed` | `2` ticket number, `3` support email |
| 7 | Order in Production | `order-production` | `2` order number |
| 8 | Order Ready for Dispatch | `order-ready-dispatch` | `2` order number |
| 9 | Order Dispatched | `order-dispatched` | `order` (or `2`), `dispatchDate` (or `3`), `contact1` (or `4`), "Name: Number" format |
| 10 | Order Installation | `order-installation` | `2` order number |
| 11 | Order Handover | `order-handover` | `2` order number |

### Admin notifications (sent to every Admin with a saved WhatsApp number)

Send `adminPhones` (e.g. `["919876543210"]`) to choose who gets it, for example when testing. If you omit it, every Admin with a number saved in the app is notified. `phone` and `name` are not used. Put the template values in `variables`, **including `1`**.

| # | Event | Slug | `variables` |
|---|---|---|---|
| 12 | Enquiry Cancelled / On Hold | `enquiry-cancelled` | `1` status (Cancelled / On Hold), `2` enquiry ID, `3` customer, `4` requirement, `5` reason |
| 13 | Enquiry Delay (no follow-up) | `delay-enquiry` | `1` enquiry ID, `2` customer, `3` days without update, `4` last activity |
| 14 | Enquiry Converted | `enquiry-converted` | `1` enquiry ID, `2` sales order number, `3` customer, `4` sales manager |

### Sales Manager notification (sent to every Sales Manager with a saved WhatsApp number)

| # | Event | Slug | `variables` |
|---|---|---|---|
| 15 | Pre-booked Follow-up | `prebooked-followup` | `1` order number, `2` project, `3` customer, `4` last contacted, `5` next action |

For the sales manager trigger, send `salesManagerPhones` the same way; if omitted, every Sales Manager with a saved number is notified. Saved numbers are set by an admin on the app's **Users** page.

## 5. Test mode (do not notify admins / sales managers)

While testing, add `test=true` (URL parameter or body field) to an admin or sales manager trigger. The app then **ignores the numbers saved for admins and sales managers** and sends only to the number you pass in `phone`:

```
POST /api/v1/triggers/enquiry-cancelled?test=true
{ "phone": "919876543210", "variables": { "1": "On Hold", "2": "ENQ-1", "3": "Rahul", "4": "Kitchen", "5": "Postponed" } }
```

If `test=true` is sent without a `phone`, the API answers `400 TEST_MODE_NEEDS_PHONE` and sends nothing. Customer triggers always go only to `phone`.

## 6. List triggers and their status

```
GET /api/v1/triggers
```

Returns each trigger's slug, label, whether it is enabled and which template it uses.

## 7. Errors

| HTTP | `error.code` | Meaning |
|---|---|---|
| 401 | `MISSING_API_KEY` | No `Authorization: Bearer …` header |
| 401 | `INVALID_API_KEY` | Key is wrong, disabled or revoked |
| 400 | `INVALID_PHONE` | Phone number is not valid (10-digit Indian numbers get 91 added automatically) |
| 400 | `MISSING_VARIABLES` | The template needs more variables; the message lists the missing `{{n}}` |
| 400 | `MISSING_NAME` | `name` is required for customer notifications |
| 400 | `TEST_MODE_NEEDS_PHONE` | `test=true` needs the `phone` to send to |
| 404 | `UNKNOWN_TRIGGER` | Slug is not one of the 15 above |
| 429 | `RATE_LIMITED` | More than 60 requests/minute |
| 502 | `SEND_FAILED` | WhatsApp rejected the message (template not approved, wrong template name, insufficient wallet balance...). `error.message` has WhatsApp's reason |

Error body format:

```json
{ "success": false, "error": { "code": "INVALID_PHONE", "message": "Invalid phone number ..." } }
```

## 8. Integration checklist

1. Receive your API key from KSS and store it as a server-side secret.
2. Confirm the triggers you need are enabled in the app (**Settings → Triggers**).
3. Make sure admins and sales managers have signed up and their WhatsApp numbers are saved (**Users** page).
4. Call `GET /api/v1/triggers` to confirm the key works.
5. Call each trigger from your software when the event happens, sending the variables listed above.
6. Check `data.fired` in every response.
