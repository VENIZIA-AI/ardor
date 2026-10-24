import React from 'react';

import { isBrowser } from '@venizia/ardor-kernel';

const readWindowDimensions = () => {
  // Where there is no window (a server render) the size is 0 x 0 until the browser measures it.
  return isBrowser()
    ? { width: window.innerWidth, height: window.innerHeight }
    : { width: 0, height: 0 };
};

export const useWindowDimensions = () => {
  const [windowDimensions, setWindowDimensions] = React.useState(readWindowDimensions);

  React.useEffect(() => {
    const resizeHandler = () => {
      setWindowDimensions(readWindowDimensions());
    };

    // The state may have been 0 x 0 from a server render.
    resizeHandler();
    window.addEventListener('resize', resizeHandler);

    return () => {
      window.removeEventListener('resize', resizeHandler);
    };
  }, []);

  return windowDimensions;
};
