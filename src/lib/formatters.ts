const formatGrouping = (value: number) => value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export const formatPrice = (value: number) => `${formatGrouping(Math.round(value))} AZN`;

export const formatNumber = (value: number) => formatGrouping(Math.round(value));

export const formatDate = (value: string) => {
  const date = new Date(value);
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
};

