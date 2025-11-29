import json
import os
# Try to import psycopg2, handle if not installed
try:
    import psycopg2
    from psycopg2.extras import Json
except ImportError:
    print("Error: psycopg2 module not found. Please install it using: pip install psycopg2-binary")
    exit(1)

# ==========================================
# DATABASE CONFIGURATION
# Please fill in your Supabase connection details below
# ==========================================
DB_HOST = "aws-1-ap-southeast-2.pooler.supabase.com"
DB_NAME = "postgres"
DB_USER = "postgres.fwpnqtfeknvdbnmurckz"
DB_PASSWORD = "softwarhcmus"
DB_PORT = "5432" # Default Supabase port is usually 5432 or 6543 (transaction pooler)

# File Paths
ITEMS_JSON_PATH = 'items.json'
TFT_15_ITEMS_PATH = 'tft-15-items.json'

def main():
    # 1. Load the target list of item names from tft-15-items.json
    print(f"Loading target items from {TFT_15_ITEMS_PATH}...")
    try:
        with open(TFT_15_ITEMS_PATH, 'r', encoding='utf-8') as f:
            target_names = json.load(f)
    except FileNotFoundError:
        print(f"Error: File {TFT_15_ITEMS_PATH} not found.")
        return

    # 2. Load the full items data from items.json
    print(f"Loading item details from {ITEMS_JSON_PATH}...")
    try:
        with open(ITEMS_JSON_PATH, 'r', encoding='utf-8') as f:
            items_data_raw = json.load(f)
    except FileNotFoundError:
        print(f"Error: File {ITEMS_JSON_PATH} not found.")
        return

    # 3. Build a lookup map: Name -> Item Data
    # This allows us to find the item details (like ID) using the name from the target list.
    name_to_item_map = {}
    if 'data' in items_data_raw:
        for key, item in items_data_raw['data'].items():
            name = item.get('name')
            if name:
                # Note: If multiple items have the same name, the last one processed will be used.
                # Given the dataset, we assume names are sufficiently unique for this purpose.
                name_to_item_map[name] = item
    else:
        print("Error: 'data' key not found in items.json")
        return

    # 4. Connect to the Database
    print("Connecting to database...")
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            port=DB_PORT
        )
        cur = conn.cursor()
        print("Connected successfully.")
    except Exception as e:
        print(f"Database connection failed: {e}")
        print("Please check your DB_HOST, DB_PASSWORD, etc. in the script.")
        return

    # 5. Iterate through target names and insert into DB
    success_count = 0
    skipped_count = 0

    print("\nStarting import...")
    
    for name in target_names:
        item_details = name_to_item_map.get(name)
        
        if not item_details:
            print(f"[SKIP] Item '{name}' not found in items.json")
            skipped_count += 1
            continue

        # Extract required fields
        item_id = item_details.get('id')
        
        # Construct Icon URL
        # Format: https://ddragon.leagueoflegends.com/cdn/15.23.1/img/tft-item/{item.id}.png
        # We use the version hardcoded as 15.23.1 based on the prompt/file context, 
        # or we could extract it from items.json['version'].
        version = items_data_raw.get('version', '15.23.1')
        icon_url = f"https://ddragon.leagueoflegends.com/cdn/{version}/img/tft-item/{item_id}.png"
        
        desc = "" # User requested to leave empty
        effects = {} # User requested to leave empty (jsonb)
        season = "15" # User requested season 15

        try:
            # SQL Insert Statement
            insert_query = """
                INSERT INTO public.static_items (id, name, "iconUrl", "desc", effects, season)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) 
                DO UPDATE SET
                    name = EXCLUDED.name,
                    "iconUrl" = EXCLUDED."iconUrl",
                    season = EXCLUDED.season;
            """
            # Note: "desc" is a reserved keyword in some SQL dialects, quoting it is safer.
            # Using ON CONFLICT to update if it already exists, or DO NOTHING if preferred.
            
            cur.execute(insert_query, (
                item_id,
                name,
                icon_url,
                desc,
                Json(effects),
                season
            ))
            success_count += 1
            # print(f"[OK] Inserted/Updated: {name} ({item_id})")
            
        except Exception as e:
            print(f"[ERROR] Failed to insert {name}: {e}")
            conn.rollback() # Rollback the transaction on error
            continue

    # Commit the changes
    conn.commit()
    cur.close()
    conn.close()

    print(f"\nImport finished.")
    print(f"Successfully processed: {success_count}")
    print(f"Skipped (not found): {skipped_count}")

if __name__ == "__main__":
    main()
