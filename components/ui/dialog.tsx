import * as React from 'react';
import { Platform, StyleSheet, View, Modal, Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { TextClassContext } from '~/components/ui/text';
import { cn } from '~/lib/utils';
import { Card } from '~/components/ui/card';

interface DialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  children: React.ReactNode;
}

const Dialog = ({ isOpen, onOpenChange, children }: DialogProps) => {
  return (
    <Modal
      transparent
      visible={isOpen}
      animationType="fade"
      onRequestClose={() => onOpenChange(false)}
    >
      <Pressable 
        style={StyleSheet.absoluteFill}
        className="bg-black/50 flex items-center justify-center"
        onPress={() => onOpenChange(false)}
      >
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          className="max-w-[90%] w-full max-h-[90%]"
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            {children}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const DialogContent = React.forwardRef<
  React.ElementRef<typeof Card>,
  React.ComponentPropsWithoutRef<typeof Card>
>(({ className, ...props }, ref) => (
  <TextClassContext.Provider value="text-foreground">
    <Card
      ref={ref}
      className={cn("bg-background p-6", className)}
      {...props}
    />
  </TextClassContext.Provider>
));
DialogContent.displayName = 'DialogContent';

const DialogHeader = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof View>) => (
  <View className={cn("flex flex-col space-y-1.5 mb-4", className)} {...props} />
);

const DialogFooter = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof View>) => (
  <View className={cn("flex flex-row justify-end space-x-2 mt-6", className)} {...props} />
);

export { Dialog, DialogContent, DialogHeader, DialogFooter };