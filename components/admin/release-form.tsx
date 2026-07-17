          <div className="adminFieldGrid">
            <label className="adminField adminFieldWide"><span>KÜNSTLER *</span><input name="artist" required maxLength={200} disabled={disabled} defaultValue={editing?.artist} placeholder="z. B. Erabi" /></label>
            <label className="adminField adminFieldWide"><span>ALBUM / SINGLE / EP TITEL *</span><input name="title" required maxLength={240} disabled={disabled} defaultValue={editing?.title} placeholder="z. B. Endgame" /></label>
            <label className="adminField"><span>TYP *</span><select name="kind" defaultValue={editing?.kind ?? "album"} required disabled={disabled}><option value="album">ALBUM</option><option value="ep">EP</option><option value="single">SINGLE</option><option value="mixtape">MIXTAPE</option></select></label>
            <label className="adminField"><span>LAND *</span><select name="country" defaultValue={editing?.country ?? "DE"} required disabled={disabled}><option value="DE">DEUTSCHLAND</option><option value="US">USA</option></select></label>
            <label className="adminField"><span>RELEASE-DATUM *</span><input name="releaseDate" type="date" defaultValue={editing?.releaseDate ?? targetDate} required disabled={disabled} /></label>
            <label className="adminField"><span>TRACKS</span><input name="trackCount" type="number" inputMode="numeric" min={1} max={999} disabled={disabled} defaultValue={editing?.trackCount} placeholder="12" /></label>
            <label className="adminField adminFieldWide"><span>GENRES</span><input name="genres" maxLength={300} disabled={disabled} defaultValue={editing?.genres.join(", ")} placeholder="Deutschrap, Hip-Hop/Rap" /><small>Mehrere Genres mit Komma trennen.</small></label>
            <label className="adminField adminFieldWide"><span>BESCHREIBUNG</span><textarea name="description" rows={5} maxLength={5000} disabled={disabled} defaultValue={editing?.description} placeholder="Kurzer redaktioneller Text zum Release …" /></label>
          </div>
        </section>

        <section className="adminFormSection">
          <div className="adminFormSectionTitle"><span>03</span><strong>LINKS</strong></div>
          <div className="adminFieldGrid">
            <label className="adminField adminFieldWide"><span>SPOTIFY</span><input name="spotifyUrl" type="url" inputMode="url" disabled={disabled} defaultValue={editing?.spotifyUrl} placeholder="https://open.spotify.com/album/…" /></label>
            <label className="adminField adminFieldWide"><span>SPOTIFY PRE-SAVE</span><input name="spotifyPreSaveUrl" type="url" inputMode="url" disabled={disabled} defaultValue={editing?.spotifyPreSaveUrl} placeholder="https://…" /></label>
            <label className="adminField adminFieldWide"><span>APPLE MUSIC</span><input name="appleMusicUrl" type="url" inputMode="url" disabled={disabled} defaultValue={editing?.appleMusicUrl} placeholder="https://music.apple.com/…" /></label>
            <label className="adminField adminFieldWide"><span>YOUTUBE</span><input name="youtubeUrl" type="url" inputMode="url" disabled={disabled} defaultValue={editing?.youtubeUrl} placeholder="https://youtube.com/…" /></label>
            <label className="adminField adminFieldWide"><span>QUELLEN-LINK</span><input name="sourceUrl" type="url" inputMode="url" disabled={disabled} defaultValue={editing?.sourceUrl} placeholder="Offizielle Ankündigung oder Label-Seite" /></label>
          </div>
        </section>

        {error ? <p className="adminError" role="alert">{error}</p> : null}
        {success ? (
          <div className="adminSuccess" role="status">
            <strong>{success.action === "deleted" ? "RELEASE GELÖSCHT" : success.action === "updated" ? "ÄNDERUNGEN GESPEICHERT" : success.status === "published" ? "RELEASE FREIGEGEBEN" : "ENTWURF GESPEICHERT"}</strong>
            <span>{success.action === "deleted" ? "Der Eintrag wurde aus Supabase entfernt." : `Gespeichert für den ${success.releaseDate}.`}</span>
            {success.status === "published" && success.action !== "deleted" ? <Link href="/">ÖFFENTLICHEN FEED ÖFFNEN →</Link> : null}
          </div>
        ) : null}

        <div className="adminActions">
          {editing ? <button type="button" className="adminSecondaryButton" onClick={() => void handleDelete(editing)} disabled={disabled}>LÖSCHEN</button> : null}
          <button type="submit" name="intent" value="draft" className="adminSecondaryButton" disabled={disabled}>{compressing ? "KOMPRIMIERT …" : busy ? "SPEICHERT …" : "ALS ENTWURF"}</button>
          <button type="submit" name="intent" value="published" className="adminPrimaryButton" disabled={disabled}>{compressing ? "KOMPRIMIERT …" : busy ? "SPEICHERT …" : editing ? "ÄNDERUNGEN SPEICHERN →" : "FÜR DROP FREIGEBEN →"}</button>
        </div>
      </form>

      <section className="adminFormSection">
        <div className="adminFormSectionTitle"><span>04</span><strong>ALLE RELEASES ({releases.length})</strong></div>
        <div className="releaseForm">
          {releases.length === 0 ? <p className="adminIntro">Noch keine Releases in Supabase gespeichert.</p> : releases.map((release) => (
            <div className="adminSuccess" key={release.id}>
              <strong>{release.artist} — {release.title}</strong>
              <span>{release.releaseDate} · {release.kind.toUpperCase()} · {release.status === "published" ? "VERÖFFENTLICHT" : "ENTWURF"}</span>
              <button type="button" className="adminTextButton" onClick={() => startEditing(release)} disabled={disabled}>BEARBEITEN →</button>
            </div>
          ))}
        </div>
      </section>
