export const wipeDatabase = async () => {
  // The admin wipe endpoint is protected by ADMIN_SECRET — ask the owner for it
  const secret = prompt('أدخل كلمة مرور الإدارة (ADMIN_SECRET) للمتابعة:');
  if (!secret) throw new Error('تم الإلغاء');
  try {
    const res = await fetch('/api/v1/admin/wipe', {
      method: 'POST',
      headers: { 'x-admin-secret': secret }
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Wipe failed');
    }
    console.log('Database and local storage wiped completely!');
  } catch (e) {
    console.error('Failed to wipe database:', e);
    throw e;
  }
};
