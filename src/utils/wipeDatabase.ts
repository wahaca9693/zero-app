export const wipeDatabase = async () => {
  try {
    const res = await fetch('/api/v1/admin/wipe', { method: 'POST' });
    if (!res.ok) throw new Error('Wipe failed');
    console.log('Database and local storage wiped completely!');
  } catch (e) {
    console.error('Failed to wipe database:', e);
    throw e;
  }
};
