export const generateRoomNumber = (): string => {
  const prefix = ['SIT', 'VTX', 'ELC'][Math.floor(Math.random() * 3)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${num}`;
};
