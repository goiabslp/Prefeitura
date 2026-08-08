import React, { useRef } from 'react';
import { useDrag, useGesture } from '@use-gesture/react';
import { motion, useSpring, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Trash2, Edit2 } from 'lucide-react';

interface GestureItemProps {
    children: React.ReactNode;
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onLongPress?: () => void;
    swipeLeftContent?: React.ReactNode;
    swipeRightContent?: React.ReactNode;
    className?: string;
    disabled?: boolean;
}

export const GestureItem: React.FC<GestureItemProps> = ({
    children,
    onSwipeLeft,
    onSwipeRight,
    onLongPress,
    swipeLeftContent,
    swipeRightContent,
    className = '',
    disabled = false,
}) => {
    const x = useMotionValue(0);
    const controls = useSpring(x, { stiffness: 500, damping: 50 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Background opacity/color logic based on drag direction
    const rightOpacity = useTransform(x, [-100, 0], [1, 0]);
    const leftOpacity = useTransform(x, [0, 100], [0, 1]);

    const bind = useGesture(
        {
            onDrag: ({ active, movement: [mx], direction: [xDir], cancel }) => {
                if (disabled) return;

                // Enable vertical scrolling by conditionally cancelling horizontal drag
                // if (active && Math.abs(mx) < Math.abs(my)) cancel();

                if (active) {
                    // Limit drag distance
                    const constrainedX = mx < -100 ? -100 - (Math.abs(mx) - 100) * 0.2 : mx > 100 ? 100 + (mx - 100) * 0.2 : mx;
                    x.set(constrainedX);
                } else {
                    // Snap back
                    x.set(0);
                }
            },
            onDragEnd: ({ movement: [mx], velocity: [vx] }) => {
                if (disabled) return;

                // Trigger threshold
                const TRIGGER_THRESHOLD = 80; // px
                const VELOCITY_THRESHOLD = 0.5;

                // Swipe Left (Negative X)
                if ((mx < -TRIGGER_THRESHOLD || (mx < -10 && vx > VELOCITY_THRESHOLD)) && onSwipeLeft) {
                    onSwipeLeft();
                }

                // Swipe Right (Positive X)
                if ((mx > TRIGGER_THRESHOLD || (mx > 10 && vx > VELOCITY_THRESHOLD)) && onSwipeRight) {
                    onSwipeRight();
                }

                // Always bounce back
                x.set(0);
            },
            // onLongPress: ({ event }) => {
            //     if (disabled) return;
            //     // event.preventDefault(); // Prevent native context menu if desired
            //     if (onLongPress) {
            //         onLongPress();
            //         // Haptic feedback pattern if supported
            //         if (navigator.vibrate) navigator.vibrate(50);
            //     }
            // }
        },
        {
            drag: {
                filterTaps: true,
                bounds: { left: -120, right: 120 },
                rubberband: true,
                axis: 'x', // Constrain to horizontal axis to allow browser vertical scrolling
                from: () => [x.get(), 0],
            },
        }
    );
    const { onDrag: _onDrag, ...gestureProps } = bind() as any;

    return (
        <div className={`relative overflow-hidden ${className}`}>
            {/* Swipe Left Action Background (Reveal on negative drag) */}
            {onSwipeLeft && (
                <motion.div
                    style={{ opacity: rightOpacity }}
                    className="absolute inset-y-0 right-0 w-full bg-red-50 flex items-center justify-end pr-8 pointer-events-none"
                >
                    {swipeLeftContent || <Trash2 className="w-6 h-6 text-red-600" />}
                </motion.div>
            )}

            {/* Swipe Right Action Background (Reveal on positive drag) */}
            {onSwipeRight && (
                <motion.div
                    style={{ opacity: leftOpacity }}
                    className="absolute inset-y-0 left-0 w-full bg-blue-50 flex items-center justify-start pl-8 pointer-events-none"
                >
                    {swipeRightContent || <Edit2 className="w-6 h-6 text-blue-600" />}
                </motion.div>
            )}

            <motion.div
                {...gestureProps}
                style={{ x, touchAction: 'pan-y' }} // pan-y explicitly allows vertical scroll
                className="w-full h-full relative z-10 bg-white"
                whileTap={{ scale: 0.98 }}
            >
                {children}
            </motion.div>
        </div>
    );
};
