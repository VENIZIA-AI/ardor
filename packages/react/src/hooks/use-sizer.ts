import React from 'react';

export interface IUseSizerOptions {
  containerId: string;
}

export interface IUseSizerReturn {
  width: number;
  height: number;
}

/** The offset size of the element with the id, kept up to date by a `ResizeObserver`. */
export const useSizer = (opts: IUseSizerOptions): IUseSizerReturn => {
  const { containerId } = opts;
  const [width, setWidth] = React.useState<number>(0);
  const [height, setHeight] = React.useState<number>(0);

  React.useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) {
      return;
    }

    const sizeObserver = new ResizeObserver(() => {
      setWidth(container.offsetWidth);
      setHeight(container.offsetHeight);
    });
    sizeObserver.observe(container);

    return () => {
      sizeObserver.disconnect();
    };
  }, [containerId]);

  return { width, height };
};
