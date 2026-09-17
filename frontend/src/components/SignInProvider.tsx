import { useCallback, useMemo, useState } from 'react';
import SignInDialog from './SignInDialog';
import { SignInContext } from './signin-context';

// Owns the sign-in dialog for the app shell so any page can open it.
const SignInProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [open, setOpen] = useState(false);
  const openSignIn = useCallback(() => setOpen(true), []);
  const closeSignIn = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ openSignIn }), [openSignIn]);

  return (
    <SignInContext.Provider value={value}>
      {children}
      <SignInDialog open={open} onClose={closeSignIn} />
    </SignInContext.Provider>
  );
};

export default SignInProvider;
