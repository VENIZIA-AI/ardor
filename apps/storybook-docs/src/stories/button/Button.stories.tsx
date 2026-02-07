import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '@venizia/ardor-ui-kit';
import { BotIcon, TrashIcon } from 'lucide-react';

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'Example/Button',
  component: Button,
  parameters: {
    // Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/configure/story-layout
    layout: 'centered',
    docs: {
      state: 'open',
      transformSource: (src, storyContext) => {
        const { component } = storyContext;
        if (!component) return src;

        // Lấy tên Component (ví dụ: Button)
        const componentName = component.displayName || component.name;

        // Tạo dòng import mong muốn
        const importStatement = `import { ${componentName} } from '@your-package/ui';\n\n`;

        return importStatement + src;
      },
    },
  },
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ['autodocs'],
  // More on argTypes: https://storybook.js.org/docs/api/argtypes
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: [
        'default',
        'destructive',
        'outline',
        'secondary',
        'ghost',
        'link',
        'default-active',
        'destructive-active',
        'glassmorphism',
      ],
    },
    size: {
      control: { type: 'select' },
      options: ['xs', 'sm', 'default', 'lg', 'icon-xxs', 'icon-xs', 'icon-sm', 'icon', 'icon-lg'],
    },
    children: { control: 'text' },
  },
  // Use `fn` to spy on the onClick arg, which will appear in the actions panel once invoked: https://storybook.js.org/docs/essentials/actions#story-args
  args: {
    variant: 'default',
    size: 'default',
    children: 'Hello, Ardor',
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Primary: Story = {
  args: {},
};

export const Icon: Story = {
  render: args => (
    <Button {...args}>
      <TrashIcon />
    </Button>
  ),
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['icon-xxs', 'icon-xs', 'icon-sm', 'icon', 'icon-lg'],
    },
    children: {
      table: {
        disable: true,
      },
    },
  },
  args: {
    variant: 'destructive-active',
  },
};

export const WithIcon: Story = {
  render: args => (
    <Button {...args}>
      <BotIcon />
      Ask AI
    </Button>
  ),
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['icon-xxs', 'icon-xs', 'icon-sm', 'icon', 'icon-lg'],
    },
    children: {
      table: {
        disable: true,
      },
    },
  },
};
