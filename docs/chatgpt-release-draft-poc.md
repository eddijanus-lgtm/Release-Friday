# ChatGPT release-draft proof of concept

This proof of concept connects a private consumer ChatGPT GPT to Release Friday with one dedicated API key. It can create private drafts only. It cannot publish, update, delete, upload files, execute SQL, access GitHub, or administer Supabase.

## Why the first test uses an API key

Supabase's OAuth 2.1 server requires PKCE. OpenAI's current GPT Action OAuth documentation describes an authorization-code exchange without a PKCE verifier, so a direct Supabase-to-GPT OAuth setup should not be assumed compatible. A dedicated, revocable API key is the smaller and more reliable boundary for this private first test.

The key is not a Supabase key. It authorizes only this Edge Function and must never be reused elsewhere.

## Safety boundary

- The Edge Function accepts only a dedicated bearer API key stored in Supabase function secrets.
- The supplied key is compared with the configured key after SHA-256 hashing.
- The function's service-role credential stays inside Supabase and is never sent to ChatGPT, the website, or the repository.
- The request schema rejects unknown fields such as `status`, `created_by`, or table names.
- Every insert forces `status = draft` and `source = ChatGPT Action (API key draft)`.
- Duplicate detection uses normalized artist, title, and release date.
- The stored record is read again before success is returned.
- The function implements no publish, update, delete, file-upload, SQL, GitHub, or administration operation.
- The key can be revoked immediately by deleting or replacing the Supabase function secret.

The Edge Function is deployed with gateway JWT verification disabled because the bearer value is a dedicated API key, not a Supabase JWT. Anonymous requests are still rejected by the function's custom authentication before any database operation.

## One-time Supabase setup

1. Generate a unique high-entropy key in a password manager or with:

   ```bash
   openssl rand -hex 32
   ```

2. In the Supabase dashboard, open the Release Friday project's Edge Function secrets.
3. Create a secret named `CHATGPT_RELEASE_DRAFT_API_KEY` and use the generated value.
4. Never place the value in GitHub, the OpenAPI file, GPT instructions, or an ordinary chat message.
5. Keep the function URL as:

   `https://otjvkorslczqdpzltjpj.supabase.co/functions/v1/chatgpt-release-drafts`

## Private consumer GPT setup

Create and edit the GPT on `chatgpt.com`; after it is saved, the customer can use it from the normal ChatGPT app, including iOS.

1. Create a private GPT named `Release Friday Draft Editor`.
2. Add the instructions below.
3. Open **Actions** and import `docs/chatgpt-release-drafts.openapi.yaml`.
4. Open **Authentication**, select **API Key**, and choose **Bearer** authentication.
5. Paste the same `CHATGPT_RELEASE_DRAFT_API_KEY` value into the protected API-key field.
6. Keep the GPT private for the first test. Anyone with access to a shared GPT could use its configured action.

OpenAI states that GPT Action API keys are encrypted when stored. See the official [GPT Action authentication documentation](https://developers.openai.com/api/docs/actions/authentication).

## GPT instructions

```text
You are the private Release Friday draft editor.

Your only write capability is createReleaseDraft. It always creates a non-public draft.
You cannot publish, update, delete, upload a file, change database structure, or access GitHub.

Before calling the action:
1. Collect artist, title, release date, country (DE or US), and kind (album, ep, single, or mixtape).
2. Never invent links, dates, track counts, genres, covers, or other metadata.
3. Put Spotify album URLs only in spotify_url and Spotify /prerelease/ URLs only in spotify_pre_save_url.
4. If required information is missing, ask one concise question.
5. Show a compact preview and explicitly ask the user to confirm creation of the draft.
6. Call createReleaseDraft only after the user confirms.

After a successful call, report the returned record ID, artist, title, release date, and that the release remains private until published in /admin/.
If the API reports a duplicate, do not retry or create an altered copy.
Respond in the language used by the user.
```

## First test

Use an obviously non-production test entry and keep it as a draft:

```text
Create a Release Friday test draft.
Artist: Action Test Artist
Title: ChatGPT Draft Test
Release date: 2099-12-31
Country: DE
Kind: single
```

After the test, verify the row under `/admin/` and delete the test entry manually there. Rotate the API key after the proof of concept if it was copied through any insecure channel.
