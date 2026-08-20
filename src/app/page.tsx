'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useProfiles } from '@/components/profile/ProfileProvider';

export default function ProfilePage() {
  const { hydrated, profiles, activeProfile, create, select, remove } = useProfiles();
  const [name, setName] = useState('');

  if (!hydrated) return <main><p>Loading…</p></main>;

  return (
    <main>
      <h1>Who&apos;s drilling?</h1>

      <ul aria-label="Profiles">
        {profiles.map((profile) => (
          <li key={profile.id}>
            <button onClick={() => select(profile.id)} aria-pressed={profile.id === activeProfile?.id}>
              {profile.name}
            </button>
            <button onClick={() => remove(profile.id)} aria-label={`Delete ${profile.name}`}>
              Delete
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={(event) => { event.preventDefault(); create(name); setName(''); }}>
        <label htmlFor="new-profile">New profile</label>
        <input id="new-profile" value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" />
        <button type="submit">Add</button>
      </form>

      {activeProfile && <Link href="/setup">Start a session as {activeProfile.name}</Link>}
    </main>
  );
}
