import { useEffect, useState, type ReactNode } from 'react';
import { get } from '../api/client';
import { useAuth } from '../auth/auth-context';
import { PetOptionsContext, type PetOptions } from './pet-options-context';

const PET_OPTIONS_PATH = '/api/pet-options/';

export function PetOptionsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [options, setOptions] = useState<PetOptions | null>(null);

  useEffect(() => {
    if (status !== 'signed-in') return;
    let cancelled = false;

    async function load() {
      try {
        const data = await get<PetOptions>(PET_OPTIONS_PATH);
        if (!cancelled) setOptions(data);
      } catch {
        // views show empty lists until the next sign-in
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const value = status === 'signed-in' ? options : null;
  return <PetOptionsContext value={value}>{children}</PetOptionsContext>;
}
