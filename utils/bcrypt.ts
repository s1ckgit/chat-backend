import bc from 'bcrypt';

async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  const hashedPassword = await bc.hash(password, saltRounds);
  return hashedPassword;
}

async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  const isMatch = await bc.compare(password, hashedPassword);
  return isMatch;
}

export {
  hashPassword,
  verifyPassword
}
