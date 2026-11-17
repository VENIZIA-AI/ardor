import { AbstractArdorApplication } from '@/base/applications/abstract';

/** The application the kernel tests extend: the kernel binds no default provider, so it adds nothing. */
export abstract class TestArdorApplication extends AbstractArdorApplication {}
