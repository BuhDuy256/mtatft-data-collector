-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.match_traits (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  num_units integer,
  tier_current integer,
  tier_total integer,
  match_id text NOT NULL,
  puuid text NOT NULL,
  CONSTRAINT match_traits_pkey PRIMARY KEY (id),
  CONSTRAINT fk_traits_participants FOREIGN KEY (match_id) REFERENCES public.participants(match_id),
  CONSTRAINT fk_traits_participants FOREIGN KEY (match_id) REFERENCES public.participants(puuid),
  CONSTRAINT fk_traits_participants FOREIGN KEY (puuid) REFERENCES public.participants(match_id),
  CONSTRAINT fk_traits_participants FOREIGN KEY (puuid) REFERENCES public.participants(puuid)
);
CREATE TABLE public.match_unit_items (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  unit_instance_id bigint,
  item_name text NOT NULL,
  CONSTRAINT match_unit_items_pkey PRIMARY KEY (id),
  CONSTRAINT match_unit_items_unit_instance_id_fkey FOREIGN KEY (unit_instance_id) REFERENCES public.match_units(id)
);
CREATE TABLE public.match_units (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  unit_id text NOT NULL,
  tier integer DEFAULT 1,
  item_names ARRAY,
  name text,
  rarity integer,
  match_id text NOT NULL,
  puuid text NOT NULL,
  CONSTRAINT match_units_pkey PRIMARY KEY (id),
  CONSTRAINT fk_units_participants FOREIGN KEY (match_id) REFERENCES public.participants(match_id),
  CONSTRAINT fk_units_participants FOREIGN KEY (match_id) REFERENCES public.participants(puuid),
  CONSTRAINT fk_units_participants FOREIGN KEY (puuid) REFERENCES public.participants(match_id),
  CONSTRAINT fk_units_participants FOREIGN KEY (puuid) REFERENCES public.participants(puuid)
);
CREATE TABLE public.matches (
  id text NOT NULL,
  data_version text,
  game_version text,
  game_datetime timestamp with time zone,
  game_length double precision,
  queue_id integer,
  tft_set_number integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT matches_pkey PRIMARY KEY (id)
);
CREATE TABLE public.meta_comp_units (
  id integer NOT NULL DEFAULT nextval('meta_comp_units_id_seq'::regclass),
  meta_comp_id integer,
  unit_id character varying NOT NULL,
  is_core boolean DEFAULT false,
  frequency double precision,
  items jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT meta_comp_units_pkey PRIMARY KEY (id),
  CONSTRAINT meta_comp_units_meta_comp_id_fkey FOREIGN KEY (meta_comp_id) REFERENCES public.meta_comps(id)
);
CREATE TABLE public.meta_comps (
  id integer NOT NULL DEFAULT nextval('meta_comps_id_seq'::regclass),
  snapshot_id integer,
  name text,
  comp_fingerprint text,
  tier character varying,
  avg_placement double precision NOT NULL,
  top4_rate double precision NOT NULL,
  win_rate double precision NOT NULL,
  pick_rate double precision NOT NULL,
  play_count integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  standard_comp text,
  CONSTRAINT meta_comps_pkey PRIMARY KEY (id),
  CONSTRAINT meta_comps_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES public.meta_snapshots(id)
);
CREATE TABLE public.meta_item_stats (
  id integer NOT NULL DEFAULT nextval('meta_item_stats_id_seq'::regclass),
  snapshot_id integer,
  item_id text NOT NULL,
  avg_placement double precision NOT NULL,
  top4_rate double precision NOT NULL,
  win_rate double precision NOT NULL,
  pick_rate double precision NOT NULL,
  play_count integer NOT NULL,
  top_users jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT meta_item_stats_pkey PRIMARY KEY (id),
  CONSTRAINT meta_item_stats_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES public.meta_snapshots(id)
);
CREATE TABLE public.meta_snapshots (
  id integer NOT NULL DEFAULT nextval('meta_snapshots_id_seq'::regclass),
  patch_version character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  note text,
  CONSTRAINT meta_snapshots_pkey PRIMARY KEY (id)
);
CREATE TABLE public.meta_trait_stats (
  id integer NOT NULL DEFAULT nextval('meta_trait_stats_id_seq'::regclass),
  snapshot_id integer,
  trait_id character varying NOT NULL,
  num_units integer NOT NULL,
  avg_placement double precision NOT NULL,
  top4_rate double precision NOT NULL,
  win_rate double precision NOT NULL,
  pick_rate double precision NOT NULL,
  play_count integer NOT NULL,
  CONSTRAINT meta_trait_stats_pkey PRIMARY KEY (id),
  CONSTRAINT meta_trait_stats_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES public.meta_snapshots(id)
);
CREATE TABLE public.meta_unit_stats (
  id integer NOT NULL DEFAULT nextval('meta_unit_stats_id_seq'::regclass),
  snapshot_id integer,
  unit_id character varying NOT NULL,
  avg_placement double precision NOT NULL,
  top4_rate double precision NOT NULL,
  win_rate double precision NOT NULL,
  pick_rate double precision NOT NULL,
  play_count integer NOT NULL,
  best_items jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT meta_unit_stats_pkey PRIMARY KEY (id),
  CONSTRAINT meta_unit_stats_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES public.meta_snapshots(id)
);
CREATE TABLE public.participants (
  match_id text NOT NULL,
  puuid text NOT NULL,
  placement integer NOT NULL,
  level integer NOT NULL,
  gold_left integer,
  last_round integer,
  time_eliminated double precision,
  total_damage_to_players integer,
  CONSTRAINT participants_pkey PRIMARY KEY (match_id, puuid),
  CONSTRAINT participants_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id)
);
CREATE TABLE public.players (
  puuid text NOT NULL,
  game_name text,
  tag_line text,
  tier text,
  rank text,
  league_points integer DEFAULT 0,
  wins integer DEFAULT 0,
  losses integer DEFAULT 0,
  veteran boolean DEFAULT false,
  inactive boolean DEFAULT false,
  fresh_blood boolean DEFAULT false,
  hot_streak boolean DEFAULT false,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT players_pkey PRIMARY KEY (puuid)
);
CREATE TABLE public.raw_matches (
  match_id text NOT NULL,
  data jsonb NOT NULL,
  region text,
  is_processed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT raw_matches_pkey PRIMARY KEY (match_id)
);
CREATE TABLE public.static_items (
  id character varying NOT NULL,
  name character varying,
  iconUrl character varying,
  desc text,
  effects jsonb,
  season character varying NOT NULL,
  CONSTRAINT static_items_pkey PRIMARY KEY (id)
);
CREATE TABLE public.static_traits (
  id character varying NOT NULL,
  name character varying NOT NULL,
  iconUrl character varying,
  description text,
  effects jsonb,
  season character varying NOT NULL,
  CONSTRAINT static_traits_pkey PRIMARY KEY (id)
);
CREATE TABLE public.static_units (
  id character varying NOT NULL,
  name character varying NOT NULL,
  cost integer NOT NULL,
  iconUrl character varying,
  season character varying NOT NULL,
  CONSTRAINT static_units_pkey PRIMARY KEY (id)
);
CREATE TABLE public.unit_traits (
  unitId character varying NOT NULL,
  traitId character varying NOT NULL,
  CONSTRAINT unit_traits_pkey PRIMARY KEY (unitId, traitId),
  CONSTRAINT unit_traits_unitid_foreign FOREIGN KEY (unitId) REFERENCES public.static_units(id),
  CONSTRAINT unit_traits_traitid_foreign FOREIGN KEY (traitId) REFERENCES public.static_traits(id)
);