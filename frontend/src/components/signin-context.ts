import { createContext, useContext } from 'react';

export type SignInContextValue = { openSignIn: () => void };

// Lets any app page open the sign-in dialog (header, analyze page, empty
// states) without knowing where the dialog lives.
export const SignInContext = createContext<SignInContextValue>({
  openSignIn: () => {},
});

export const useSignIn = () => useContext(SignInContext);
