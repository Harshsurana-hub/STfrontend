'use client';

import { useState } from 'react';
import Image from 'next/image';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  image: string;
  bio?: string;
}

interface TeamGridProps {
  members: TeamMember[];
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function MemberPhoto({ member }: { member: TeamMember }) {
  const [errored, setErrored] = useState(false);

  if (errored || !member.image) {
    return (
      <div
        role="img"
        aria-label={member.name}
        className="absolute inset-0 flex items-center justify-center"
      >
        <span aria-hidden="true" className="text-4xl font-semibold text-[#7F77DD]">
          {getInitials(member.name)}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={member.image}
      alt={member.name}
      fill
      className="object-cover transition group-hover:scale-105"
      onError={() => setErrored(true)}
    />
  );
}

export function TeamGrid({ members }: TeamGridProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {members.map((member) => (
        <div
          key={member.id}
          className="group rounded-[24px] border border-[#D5D2F6] bg-white p-6 shadow-sm transition hover:shadow-md"
        >
          <div className="relative mb-4 aspect-square overflow-hidden rounded-[16px] bg-[#EEEDFE]">
            <MemberPhoto member={member} />
          </div>
          <h3 className="text-lg font-semibold text-[#26215C]">{member.name}</h3>
          <p className="text-sm font-medium text-[#7F77DD]">{member.role}</p>
          {member.bio && (
            <p className="mt-2 text-sm leading-6 text-[#5A5578]">{member.bio}</p>
          )}
        </div>
      ))}
    </div>
  );
}
