// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Deno.serve(async (req) => {
//     const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
//     try {
//         const payload = await req.json();
//         const record = payload.record;
//         // VALIDATION: Check input validity
//         if (!record || record.is_processed || !record.data) {
//             return new Response(JSON.stringify({
//                 message: 'Skipped'
//             }), {
//                 status: 200
//             });
//         }
//         const matchId = record.match_id;
//         if (!matchId) throw new Error("Record missing match_id");
//         const riotData = record.data;
//         const info = riotData.info;
//         const metadata = riotData.metadata;
//         console.log(`Processing Match ID: ${matchId}`);
//         // --- STAGE 1: MATCHES TABLE ---
//         const { error: matchError } = await supabase.from('matches').upsert({
//             id: matchId,
//             data_version: metadata.data_version,
//             game_version: info.game_version,
//             game_datetime: new Date(info.game_datetime).toISOString(),
//             game_length: info.game_length,
//             queue_id: info.queue_id,
//             tft_set_number: info.tft_set_number
//         }, {
//             onConflict: 'id'
//         });
//         if (matchError) throw new Error(`Match Insert Error: ${matchError.message}`);
//         // --- STAGE 2: PARTICIPANTS LOOP ---
//         for (const p of info.participants) {
//             // Step A: Insert into 'participants' (Composite PK: match_id + puuid)
//             const { error: partError } = await supabase.from('participants').insert({
//                 match_id: matchId,
//                 puuid: p.puuid,
//                 placement: p.placement,
//                 level: p.level,
//                 gold_left: p.gold_left,
//                 last_round: p.last_round,
//                 time_eliminated: p.time_eliminated,
//                 total_damage_to_players: p.total_damage_to_players
//             });
//             if (partError) throw new Error(`Participant Insert Error: ${partError.message}`);
//             // Step B: Insert into 'match_traits'
//             const activeTraits = p.traits.filter((t) => t.tier_current > 0).map((t) => ({
//                 match_id: matchId,
//                 puuid: p.puuid,
//                 name: t.name,
//                 num_units: t.num_units,
//                 tier_current: t.tier_current,
//                 tier_total: t.tier_total
//             }));
//             if (activeTraits.length > 0) {
//                 await supabase.from('match_traits').insert(activeTraits);
//             }
//             // Step C: Insert into 'match_units' & Retrieve IDs
//             const unitsToInsert = p.units.map((u) => ({
//                 match_id: matchId,
//                 puuid: p.puuid,
//                 unit_id: u.character_id,
//                 tier: u.tier,
//                 rarity: u.rarity,
//                 item_names: u.itemNames
//             }));
//             if (unitsToInsert.length > 0) {
//                 const { data: insertedUnits, error: unitError } = await supabase.from('match_units').insert(unitsToInsert).select('id');
//                 if (unitError) throw new Error(`Unit Insert Error: ${unitError.message}`);
//                 // Step D: Insert into 'match_unit_items' (Map Items to Unit Instance ID)
//                 const itemsToInsert = [];
//                 for (let i = 0; i < insertedUnits.length; i++) {
//                     const unitInstanceId = insertedUnits[i].id;
//                     const originalUnit = p.units[i];
//                     if (originalUnit.itemNames && originalUnit.itemNames.length > 0) {
//                         originalUnit.itemNames.forEach((itemName) => {
//                             itemsToInsert.push({
//                                 unit_instance_id: unitInstanceId,
//                                 item_name: itemName
//                             });
//                         });
//                     }
//                 }
//                 if (itemsToInsert.length > 0) {
//                     await supabase.from('match_unit_items').insert(itemsToInsert);
//                 }
//             }
//         }
//         // --- STAGE 3: FINALIZE (Update Raw Status) ---
//         await supabase.from('raw_matches').update({
//             is_processed: true
//         }).eq('match_id', matchId);
//         return new Response(JSON.stringify({
//             success: true,
//             matchId
//         }), {
//             headers: {
//                 'Content-Type': 'application/json'
//             },
//             status: 200
//         });
//     } catch (err) {
//         console.error('Processing Failed:', err);
//         return new Response(JSON.stringify({
//             error: err.message
//         }), {
//             headers: {
//                 'Content-Type': 'application/json'
//             },
//             status: 500
//         });
//     }
// });
