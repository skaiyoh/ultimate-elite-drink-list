'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useProfiles } from '@/components/profile/ProfileProvider';
import './profiles.css';

export default function ProfilePage() {
  const { hydrated, profiles, activeProfile, create, select, remove } = useProfiles();
  const [name, setName] = useState('');

  if (!hydrated) return <main><p>Loading…</p></main>;

  return (
    <main>
      <h1>Who&apos;s drilling?</h1>
      <p className="lede">
        Profiles keep history apart on a shared device. They are not accounts — there is no password.
      </p>

      {profiles.length === 0 ? (
        <p className="empty">No profiles yet. Add a name to start keeping times.</p>
      ) : (
        <ul className="profiles" aria-label="Profiles">
          {profiles.map((profile) => (
            <li key={profile.id} className="profile" data-active={profile.id === activeProfile?.id}>
              <button
                className="profile__pick"
                onClick={() => select(profile.id)}
                aria-pressed={profile.id === activeProfile?.id}
              >
                {profile.name}
              </button>
              <button
                className="profile__remove is-quiet"
                onClick={() => {
                  // Deleting a profile orphans its session history, which has
                  // no undo, so it costs one confirmation.
                  if (window.confirm(`Delete ${profile.name}? Their session history stays on the device but becomes unreachable.`)) {
                    remove(profile.id);
                  }
                }}
                aria-label={`Delete ${profile.name}`}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="profiles__add"
        onSubmit={(event) => { event.preventDefault(); create(name); setName(''); }}
      >
        <label htmlFor="new-profile">New profile</label>
        <input
          id="new-profile"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name"
        />
        <button type="submit">Add</button>
      </form>

      {activeProfile && (
        <p className="profiles__go">
          <Link className="is-primary" href="/setup">Start a session as {activeProfile.name}</Link>
        </p>
      )}
    </main>
  );
}
