# Public release cover recovery

The recovery step targets published releases that still use a Spotify artist-image fallback.

It queries the public iTunes catalog without requiring an Apple Music subscription or user login. A cover is only accepted when artist, title and release date match. Matching rows are updated in Supabase with the public Apple Music URL and release artwork.

The workflow intentionally keeps Spotify API credentials out of the cover lookup path.
