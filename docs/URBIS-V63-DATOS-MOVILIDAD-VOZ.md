# URBIS V63 · Datos recomendados para movilidad y voz GPS

Estas tablas se recomiendan si se quiere persistir en Excel/SheetDB la navegación y los avisos de voz.

## mobility_routes
- route_id
- user_id
- role
- started_at
- finished_at
- transport_mode
- origin_lat
- origin_lng
- destination_lat
- destination_lng
- total_distance_m
- estimated_duration_s
- completed_distance_m
- status

## mobility_route_points
- route_id
- sequence
- lat
- lng
- cumulative_m

## mobility_voice_events
- event_id
- route_id
- user_id
- event_at
- event_type
- text
- maneuver_id
- distance_to_event_m
- source

## mobility_alert_events
- event_id
- route_id
- alert_id
- alert_type
- origin
- announced_at
- distance_to_alert_m
- lateral_distance_m
- lat
- lng

## mobility_maneuvers
- maneuver_id
- route_id
- sequence
- route_distance_m
- instruction_text
- direction
- source
- lat
- lng

Nota: V63 guarda temporalmente eventos en localStorage con la clave `urbis_mobility_voice_events_v63`. Para persistencia real, conviene actualizar el Excel vinculado.
