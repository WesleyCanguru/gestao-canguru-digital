import React, { useEffect, useRef, useState } from 'react';
import { Palette, Upload, Download, Trash2, Plus, Loader2, Check, Type, Image as ImageIcon, Link as LinkIcon } from 'lucide-react';
import { supabase, useAuth } from '../lib/supabase';
import { useT } from '../lib/i18n';

/**
 * Marca do cliente: logos, cores, fontes, fotos aprovadas, tom de voz e regras.
 * A equipe edita; o cliente (e o designer com acesso) só vê e baixa.
 * Arquivos no bucket brand-assets em <agência>/<cliente>/...
 */
type Brand = { logos: any[]; colors: any[]; fonts: any[]; photos: any[]; voice: string; dos: string; donts: string; links: any[] };
const EMPTY: Brand = { logos: [], colors: [], fonts: [], photos: [], voice: '', dos: '', donts: '', links: [] };

export const BrandView: React.FC = () => {
  const { activeClient, userType, isViewingAsClient } = useAuth() as any;
  const { t } = useT();
  const canEdit = userType !== 'client' && !isViewingAsClient;
  const [b, setB] = useState<Brand>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [uploading, setUploading] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null); const photoRef = useRef<HTMLInputElement>(null);
  const timer = useRef<any>(null);

  useEffect(() => {
    if (!activeClient?.id) return;
    supabase.from('client_brand').select('*').eq('client_id', activeClient.id).maybeSingle().then(({ data }) => {
      setB(data ? { ...EMPTY, ...(data as any), voice: (data as any).voice || '', dos: (data as any).dos || '', donts: (data as any).donts || '' } : EMPTY);
      setLoading(false);
    });
  }, [activeClient?.id]);

  const save = (next: Brand) => {
    setB(next);
    if (!canEdit) return;
    clearTimeout(timer.current); setSaving('saving');
    timer.current = setTimeout(async () => {
      await supabase.from('client_brand').upsert({ client_id: activeClient.id, agency_id: activeClient.agency_id, ...next, updated_at: new Date().toISOString() });
      setSaving('saved'); setTimeout(() => setSaving('idle'), 1500);
    }, 600);
  };

  const upload = async (files: FileList | null, field: 'logos' | 'photos') => {
    if (!files?.length) return;
    setUploading(field);
    const added: any[] = [];
    for (const f of Array.from(files)) {
      const path = `${activeClient.agency_id}/${activeClient.id}/${field}/${Date.now()}-${f.name.replace(/[^\w.-]+/g, '_')}`;
      const { error } = await supabase.storage.from('brand-assets').upload(path, f, { upsert: false, contentType: f.type });
      if (!error) added.push({ url: supabase.storage.from('brand-assets').getPublicUrl(path).data.publicUrl, name: f.name, path });
    }
    setUploading(null);
    save({ ...b, [field]: [...b[field], ...added] });
  };
  const removeFile = async (field: 'logos' | 'photos', i: number) => {
    const it = b[field][i];
    if (it?.path) await supabase.storage.from('brand-assets').remove([it.path]);
    save({ ...b, [field]: b[field].filter((_, k) => k !== i) });
  };

  if (!activeClient) return null;
  if (loading) return <div className="py-20 text-center text-stone-400"><Loader2 className="animate-spin inline" /></div>;
  const Section: React.FC<{ icon: any; title: string; children: React.ReactNode; action?: React.ReactNode }> = ({ icon: I, title, children, action }) => (
    <section className="rounded-3xl border border-black/[0.05] bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4"><h3 className="flex items-center gap-2 font-bold text-brand-dark"><I size={17} /> {title}</h3>{action}</div>
      {children}
    </section>
  );
  const area = (k: 'voice' | 'dos' | 'donts', ph: string) => canEdit
    ? <textarea value={b[k]} onChange={e => save({ ...b, [k]: e.target.value })} rows={4} placeholder={ph} className="w-full rounded-2xl border border-stone-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
    : <p className="text-sm text-stone-700 whitespace-pre-wrap">{b[k] || '—'}</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-brand-dark flex items-center gap-2"><Palette size={22} /> {t('Marca')}</h2>
          <p className="text-sm text-stone-500 mt-1">{t('Logos, cores, fontes e fotos aprovadas da marca, num lugar só.')}</p>
        </div>
        {canEdit && <span className="text-xs text-stone-400 inline-flex items-center gap-1">{saving === 'saving' ? <><Loader2 size={12} className="animate-spin" /> salvando</> : saving === 'saved' ? <><Check size={12} className="text-emerald-600" /> salvo</> : null}</span>}
      </div>

      <Section icon={ImageIcon} title={t('Logos')} action={canEdit && <button onClick={() => logoRef.current?.click()} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700">{uploading === 'logos' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {t('Enviar')}</button>}>
        <input ref={logoRef} type="file" multiple accept="image/*,.svg,.pdf,.ai,.eps" hidden onChange={e => upload(e.target.files, 'logos')} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {b.logos.map((l, i) => (
            <div key={i} className="group relative rounded-2xl border border-stone-100 bg-[repeating-conic-gradient(#f5f5f4_0_25%,#fff_0_50%)] bg-[length:16px_16px] aspect-square flex items-center justify-center p-3">
              {/\.(png|jpe?g|svg|webp|gif)(\?|$)/i.test(l.url) ? <img src={l.url} alt={l.name} className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-stone-500 break-all">{l.name}</span>}
              <div className="absolute inset-x-2 bottom-2 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                <a href={l.url} download target="_blank" rel="noreferrer" className="p-1.5 rounded-lg bg-white shadow text-stone-600"><Download size={13} /></a>
                {canEdit && <button onClick={() => removeFile('logos', i)} className="p-1.5 rounded-lg bg-white shadow text-rose-600"><Trash2 size={13} /></button>}
              </div>
            </div>
          ))}
          {!b.logos.length && <p className="text-sm text-stone-400 col-span-full">{t('Nenhum logo ainda.')}</p>}
        </div>
      </Section>

      <Section icon={Palette} title={t('Cores')} action={canEdit && <button onClick={() => save({ ...b, colors: [...b.colors, { name: '', hex: '#000000' }] })} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700"><Plus size={14} /> {t('Adicionar')}</button>}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {b.colors.map((c, i) => (
            <div key={i} className="rounded-2xl border border-stone-100 overflow-hidden">
              <div className="h-20" style={{ background: c.hex }} />
              <div className="p-2.5 space-y-1">
                {canEdit ? <>
                  <input value={c.name} placeholder={t('Nome')} onChange={e => { const x = [...b.colors]; x[i] = { ...c, name: e.target.value }; save({ ...b, colors: x }); }} className="w-full text-sm font-semibold outline-none" />
                  <div className="flex items-center gap-2"><input type="color" value={c.hex} onChange={e => { const x = [...b.colors]; x[i] = { ...c, hex: e.target.value }; save({ ...b, colors: x }); }} className="w-6 h-6 rounded" /><input value={c.hex} onChange={e => { const x = [...b.colors]; x[i] = { ...c, hex: e.target.value }; save({ ...b, colors: x }); }} className="flex-1 text-xs font-mono text-stone-500 outline-none" /><button onClick={() => save({ ...b, colors: b.colors.filter((_, k) => k !== i) })} className="text-stone-300 hover:text-rose-600"><Trash2 size={12} /></button></div>
                </> : <><div className="text-sm font-semibold">{c.name || '—'}</div><button onClick={() => navigator.clipboard.writeText(c.hex)} className="text-xs font-mono text-stone-500">{c.hex}</button></>}
              </div>
            </div>
          ))}
          {!b.colors.length && <p className="text-sm text-stone-400 col-span-full">{t('Nenhuma cor ainda.')}</p>}
        </div>
      </Section>

      <Section icon={Type} title={t('Fontes')} action={canEdit && <button onClick={() => save({ ...b, fonts: [...b.fonts, { name: '', use: '', url: '' }] })} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700"><Plus size={14} /> {t('Adicionar')}</button>}>
        <div className="space-y-2">
          {b.fonts.map((f, i) => canEdit ? (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.4fr_auto] gap-2">
              <input value={f.name} placeholder={t('Fonte (ex.: Montserrat)')} onChange={e => { const x = [...b.fonts]; x[i] = { ...f, name: e.target.value }; save({ ...b, fonts: x }); }} className="rounded-xl border border-stone-200 px-3 py-2 text-sm" />
              <input value={f.use} placeholder={t('Uso (títulos, textos)')} onChange={e => { const x = [...b.fonts]; x[i] = { ...f, use: e.target.value }; save({ ...b, fonts: x }); }} className="rounded-xl border border-stone-200 px-3 py-2 text-sm" />
              <input value={f.url} placeholder={t('Link para baixar (opcional)')} onChange={e => { const x = [...b.fonts]; x[i] = { ...f, url: e.target.value }; save({ ...b, fonts: x }); }} className="rounded-xl border border-stone-200 px-3 py-2 text-sm" />
              <button onClick={() => save({ ...b, fonts: b.fonts.filter((_, k) => k !== i) })} className="p-2 text-stone-300 hover:text-rose-600"><Trash2 size={15} /></button>
            </div>
          ) : (
            <div key={i} className="flex items-center justify-between rounded-xl bg-stone-50 px-4 py-2.5 text-sm"><span><b>{f.name}</b>{f.use ? ` · ${f.use}` : ''}</span>{f.url && <a href={f.url} target="_blank" rel="noreferrer" className="text-blue-700 font-semibold">{t('Baixar')}</a>}</div>
          ))}
          {!b.fonts.length && <p className="text-sm text-stone-400">{t('Nenhuma fonte ainda.')}</p>}
        </div>
      </Section>

      <Section icon={ImageIcon} title={t('Fotos aprovadas')} action={canEdit && <button onClick={() => photoRef.current?.click()} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700">{uploading === 'photos' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {t('Enviar')}</button>}>
        <input ref={photoRef} type="file" multiple accept="image/*" hidden onChange={e => upload(e.target.files, 'photos')} />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {b.photos.map((p, i) => (
            <div key={i} className="group relative aspect-square rounded-xl overflow-hidden bg-stone-100">
              <img src={p.url} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                <a href={p.url} download target="_blank" rel="noreferrer" className="p-1 rounded-md bg-white shadow text-stone-600"><Download size={12} /></a>
                {canEdit && <button onClick={() => removeFile('photos', i)} className="p-1 rounded-md bg-white shadow text-rose-600"><Trash2 size={12} /></button>}
              </div>
            </div>
          ))}
          {!b.photos.length && <p className="text-sm text-stone-400 col-span-full">{t('Para vídeos e materiais grandes, use o Google Drive do cliente.')}</p>}
        </div>
      </Section>

      <div className="grid md:grid-cols-3 gap-5">
        <Section icon={Type} title={t('Tom de voz')}>{area('voice', 'Ex.: próximo, direto, sem gírias; fala com mulheres de 30 a 50 anos.')}</Section>
        <Section icon={Check} title={t('Pode e deve')}>{area('dos', 'Ex.: mostrar a equipe, usar fotos reais da clínica.')}</Section>
        <Section icon={Trash2} title={t('Não pode')}>{area('donts', 'Ex.: falar preço no feed, usar banco de imagens.')}</Section>
      </div>

      <Section icon={LinkIcon} title={t('Links')} action={canEdit && <button onClick={() => save({ ...b, links: [...b.links, { label: '', url: '' }] })} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700"><Plus size={14} /> {t('Adicionar')}</button>}>
        <div className="space-y-2">
          {b.links.map((l, i) => canEdit ? (
            <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2">
              <input value={l.label} placeholder={t('Nome (ex.: Manual da marca)')} onChange={e => { const x = [...b.links]; x[i] = { ...l, label: e.target.value }; save({ ...b, links: x }); }} className="rounded-xl border border-stone-200 px-3 py-2 text-sm" />
              <input value={l.url} placeholder="https://" onChange={e => { const x = [...b.links]; x[i] = { ...l, url: e.target.value }; save({ ...b, links: x }); }} className="rounded-xl border border-stone-200 px-3 py-2 text-sm" />
              <button onClick={() => save({ ...b, links: b.links.filter((_, k) => k !== i) })} className="p-2 text-stone-300 hover:text-rose-600"><Trash2 size={15} /></button>
            </div>
          ) : <a key={i} href={l.url} target="_blank" rel="noreferrer" className="block rounded-xl bg-stone-50 px-4 py-2.5 text-sm font-semibold text-blue-700">{l.label || l.url}</a>)}
          {!b.links.length && (activeClient as any).drive_link && <a href={(activeClient as any).drive_link} target="_blank" rel="noreferrer" className="block rounded-xl bg-stone-50 px-4 py-2.5 text-sm font-semibold text-blue-700">Google Drive</a>}
        </div>
      </Section>
    </div>
  );
};
