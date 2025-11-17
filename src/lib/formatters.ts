const formatGrouping = (value: number) => value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export const formatPrice = (value: number) => `${formatGrouping(Math.round(value))} AZN`;

export const formatNumber = (value: number) => formatGrouping(Math.round(value));

export const formatDate = (value: string) => {
  const date = new Date(value);
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
};

export const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'naməlum';
  }

  const pad = (num: number) => String(num).padStart(2, '0');
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${day}.${month}.${date.getFullYear()}, ${hours}:${minutes}:${seconds}`;
};

