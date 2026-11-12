import { createContext } from 'react';

// When a Card is rendered inside a SeccionDesplegable, the section already draws
// the card chrome and the title, so the Card only renders its content. Each Card
// resets the flag for its own children: only the first level is embedded.
export const CardEmbebidaContext = createContext(false);
