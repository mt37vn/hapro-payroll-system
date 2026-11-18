
export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
};

export const formatNumber = (value: number) => {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value));
};

export const formatPercent = (value: number) => {
  return (value * 100).toFixed(1) + '%';
};
