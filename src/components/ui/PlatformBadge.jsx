import instagramIcon from '../../assets/instagram.png';
import tiktokIcon from '../../assets/tik-tok.png';
import threadsIcon from '../../assets/threads.png';

const styles = {
  Instagram: 'bg-violet-50 text-violet-600 border-violet-100',
  TikTok:    'bg-gray-100 text-gray-800 border-gray-200',
  Threads:   'bg-gray-100 text-gray-700 border-gray-200',
};

const logos = {
  Instagram: instagramIcon,
  TikTok:    tiktokIcon,
  Threads:   threadsIcon,
};

const sizeCls = {
  xs: { badge: 'text-[10px] px-1.5 py-0.5 gap-1',  img: 'w-3 h-3' },
  sm: { badge: 'text-xs px-2 py-0.5 gap-1.5',      img: 'w-3.5 h-3.5' },
  md: { badge: 'text-sm px-2.5 py-1 gap-1.5',      img: 'w-4 h-4' },
};

export default function PlatformBadge({ platform, size = 'sm' }) {
  const cls = styles[platform] || 'bg-gray-100 text-gray-600 border-gray-200';
  const s = sizeCls[size] || sizeCls.sm;
  const logo = logos[platform];

  return (
    <span className={`inline-flex items-center border rounded-full font-medium ${s.badge} ${cls}`}>
      {logo && <img src={logo} alt={platform} className={`${s.img} object-contain rounded-[3px]`} />}
      {platform}
    </span>
  );
}
