/**
 * OCR Feedback Dialog
 * Allows users to report incorrect OCR extractions and provide correct values
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Flag, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface OCRFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: number;
  fieldName: string;
  fieldLabel?: string;
  incorrectValue?: string;
  currentValue: string;
}

export function OCRFeedbackDialog({
  open,
  onOpenChange,
  documentId,
  fieldName,
  fieldLabel,
  incorrectValue,
  currentValue,
}: OCRFeedbackDialogProps) {
  const [correctValue, setCorrectValue] = useState(currentValue);
  const [feedbackType, setFeedbackType] = useState<'incorrect_extraction' | 'low_confidence' | 'suggestion_wrong'>('incorrect_extraction');
  const [notes, setNotes] = useState('');

  const submitFeedbackMutation = trpc.ocrFeedback.submitFeedback.useMutation();

  const handleSubmit = async () => {
    if (!correctValue.trim()) {
      toast.error('Please provide the correct value');
      return;
    }

    try {
      await submitFeedbackMutation.mutateAsync({
        documentId,
        fieldName,
        incorrectValue,
        correctValue: correctValue.trim(),
        feedbackType,
        notes: notes.trim() || undefined,
      });

      toast.success('Thank you for your feedback! This will help improve our OCR accuracy.');
      onOpenChange(false);
      
      // Reset form
      setCorrectValue(currentValue);
      setNotes('');
      setFeedbackType('incorrect_extraction');
    } catch (error) {
      toast.error('Failed to submit feedback. Please try again.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-orange-500" />
            Report OCR Issue
          </DialogTitle>
          <DialogDescription>
            Help us improve by reporting incorrect OCR extractions. Your feedback is valuable!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Field Information */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Field</Label>
            <div className="text-sm text-muted-foreground">
              {fieldLabel || fieldName}
            </div>
          </div>

          {/* Incorrect Value (if provided) */}
          {incorrectValue && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">What OCR Extracted</Label>
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm">
                {incorrectValue}
              </div>
            </div>
          )}

          {/* Correct Value */}
          <div className="space-y-2">
            <Label htmlFor="correctValue" className="text-sm font-medium">
              Correct Value <span className="text-red-500">*</span>
            </Label>
            <Input
              id="correctValue"
              value={correctValue}
              onChange={(e) => setCorrectValue(e.target.value)}
              placeholder="Enter the correct value"
              className="border-green-300 focus:border-green-500"
            />
            <p className="text-xs text-muted-foreground">
              Please provide the accurate value as it appears in the document
            </p>
          </div>

          {/* Feedback Type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Issue Type</Label>
            <RadioGroup value={feedbackType} onValueChange={(value: any) => setFeedbackType(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="incorrect_extraction" id="incorrect" />
                <Label htmlFor="incorrect" className="font-normal cursor-pointer">
                  Incorrect extraction
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="low_confidence" id="low_conf" />
                <Label htmlFor="low_conf" className="font-normal cursor-pointer">
                  Low confidence (uncertain extraction)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="suggestion_wrong" id="suggestion" />
                <Label htmlFor="suggestion" className="font-normal cursor-pointer">
                  Smart suggestion was wrong
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">
              Additional Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional context or details..."
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitFeedbackMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitFeedbackMutation.isPending || !correctValue.trim()}
          >
            {submitFeedbackMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Feedback'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
