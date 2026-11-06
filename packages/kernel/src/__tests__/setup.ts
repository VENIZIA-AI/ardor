// Kernel tests run without a DOM. Real `localStorage` exposes stored keys as own enumerable
// properties - `DefaultAuthService.cleanUp()` enumerates them - and so does `FakeStorage`.
import { FakeStorage } from '@/testing';

new FakeStorage().install();
