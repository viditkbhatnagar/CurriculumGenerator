/**
 * Tests for PPT Delivery Mode Adaptation
 * Task 9: Implement Delivery Mode Adaptation
 */

import { pptGenerationService } from '../services/pptGenerationService';
import { PPTSlide } from '../services/pptGenerationService';

describe('PPT Delivery Mode Adaptation', () => {
  // Sample slide for testing
  const createSampleSlide = (): PPTSlide => ({
    slideNumber: 1,
    slideType: 'content',
    title: 'Test Slide',
    content: {
      type: 'bullets',
      title: 'Test Slide',
      content: [
        'Point 1',
        'Point 2',
        'Point 3',
        'Point 4',
        'Point 5',
        'Point 6',
        'Point 7',
        'Point 8',
      ],
    },
    speakerNotes: 'Original speaker notes for testing.',
  });

  describe('adaptForDeliveryMode', () => {
    it('should handle in-person mode', () => {
      const slides = [createSampleSlide()];
      const adapted = pptGenerationService.adaptForDeliveryMode(slides, 'in-person');

      expect(adapted).toHaveLength(1);
      expect(adapted[0].speakerNotes).toContain('[Facilitation]');
      expect(adapted[0].visualSuggestion).toContain('[In-Person]');
    });

    it('should handle online-facilitated mode', () => {
      const slides = [createSampleSlide()];
      const adapted = pptGenerationService.adaptForDeliveryMode(slides, 'online-facilitated');

      expect(adapted).toHaveLength(1);
      expect(adapted[0].speakerNotes).toContain('[Step-by-Step Instructions]');
      expect(adapted[0].visualSuggestion).toContain('[Online Facilitated]');
    });

    it('should handle online-self-study mode', () => {
      const slides = [createSampleSlide()];
      const adapted = pptGenerationService.adaptForDeliveryMode(slides, 'online-self-study');

      expect(adapted).toHaveLength(1);
      expect(adapted[0].speakerNotes).toContain('[Self-Study Mode]');
      expect(adapted[0].visualSuggestion).toContain('[Self-Study]');
    });

    it('should handle hybrid mode', () => {
      const slides = [createSampleSlide()];
      const adapted = pptGenerationService.adaptForDeliveryMode(slides, 'hybrid');

      expect(adapted).toHaveLength(1);
      expect(adapted[0].speakerNotes).toContain('[Hybrid Facilitation]');
      expect(adapted[0].visualSuggestion).toContain('[Hybrid]');
    });

    it('should return unchanged slides for unknown delivery mode', () => {
      const slides = [createSampleSlide()];
      const adapted = pptGenerationService.adaptForDeliveryMode(slides, 'unknown-mode');

      expect(adapted).toHaveLength(1);
      expect(adapted[0]).toEqual(slides[0]);
    });
  });

  describe('In-Person Mode Adaptations', () => {
    it('should reduce text density by limiting bullets to 5', () => {
      const slide = createSampleSlide();
      const adapted = pptGenerationService.adaptForDeliveryMode([slide], 'in-person');

      const content = adapted[0].content.content as string[];
      expect(content.length).toBeLessThanOrEqual(5);
      expect(adapted[0].speakerNotes).toContain('Additional points to cover verbally');
    });

    it('should add facilitation cues', () => {
      const slide = createSampleSlide();
      const adapted = pptGenerationService.adaptForDeliveryMode([slide], 'in-person');

      expect(adapted[0].speakerNotes).toContain('[Facilitation]');
    });

    it('should prioritize role-play for case studies', () => {
      const caseSlide: PPTSlide = {
        ...createSampleSlide(),
        slideType: 'case_study',
      };
      const adapted = pptGenerationService.adaptForDeliveryMode([caseSlide], 'in-person');

      expect(adapted[0].speakerNotes).toContain('role-play');
      expect(adapted[0].speakerNotes).toContain('breakout areas');
    });
  });

  describe('Online Facilitated Mode Adaptations', () => {
    it('should add step-by-step instructions', () => {
      const slide = createSampleSlide();
      const adapted = pptGenerationService.adaptForDeliveryMode([slide], 'online-facilitated');

      expect(adapted[0].speakerNotes).toContain('Step-by-Step Instructions');
      expect(adapted[0].speakerNotes).toContain('Share screen');
    });

    it('should add breakout room prompts for case studies', () => {
      const caseSlide: PPTSlide = {
        ...createSampleSlide(),
        slideType: 'case_study',
      };
      const adapted = pptGenerationService.adaptForDeliveryMode([caseSlide], 'online-facilitated');

      expect(adapted[0].speakerNotes).toContain('Breakout Rooms');
    });

    it('should add polling prompts for formative checks', () => {
      const checkSlide: PPTSlide = {
        ...createSampleSlide(),
        slideType: 'formative_check',
      };
      const adapted = pptGenerationService.adaptForDeliveryMode([checkSlide], 'online-facilitated');

      expect(adapted[0].speakerNotes).toContain('Polling');
    });

    it('should add chat engagement prompts', () => {
      const objectivesSlide: PPTSlide = {
        ...createSampleSlide(),
        slideType: 'objectives',
      };
      const adapted = pptGenerationService.adaptForDeliveryMode(
        [objectivesSlide],
        'online-facilitated'
      );

      expect(adapted[0].speakerNotes).toContain('Chat Engagement');
    });
  });

  describe('Online Self-Study Mode Adaptations', () => {
    it('should add explanatory text to slides', () => {
      const slide = createSampleSlide();
      slide.speakerNotes =
        'This is important because it demonstrates key concepts. For example, this shows how things work.';
      const adapted = pptGenerationService.adaptForDeliveryMode([slide], 'online-self-study');

      expect(adapted[0].speakerNotes).toContain('[Self-Study Mode]');
    });

    it('should simplify case studies for solo analysis', () => {
      const caseSlide: PPTSlide = {
        ...createSampleSlide(),
        slideType: 'case_study',
      };
      caseSlide.speakerNotes = 'Students should discuss this in groups and share their findings.';
      const adapted = pptGenerationService.adaptForDeliveryMode([caseSlide], 'online-self-study');

      expect(adapted[0].speakerNotes).toContain('you');
      expect(adapted[0].speakerNotes).toContain('individual analysis');
      expect(adapted[0].speakerNotes).toContain('[Self-Study Guidance]');
    });

    it('should add self-reflection prompts to case studies', () => {
      const caseSlide: PPTSlide = {
        ...createSampleSlide(),
        slideType: 'case_study',
      };
      const adapted = pptGenerationService.adaptForDeliveryMode([caseSlide], 'online-self-study');

      const content = adapted[0].content.content as string[];
      expect(content.some((item) => item.includes('Self-Reflection'))).toBe(true);
    });
  });

  describe('Hybrid Mode Adaptations', () => {
    it('should balance text and visuals', () => {
      const slide = createSampleSlide();
      const adapted = pptGenerationService.adaptForDeliveryMode([slide], 'hybrid');

      const content = adapted[0].content.content as string[];
      expect(content.length).toBeLessThanOrEqual(6);
    });

    it('should mark slides for synchronous vs asynchronous use', () => {
      const objectivesSlide: PPTSlide = {
        ...createSampleSlide(),
        slideType: 'objectives',
      };
      const adapted = pptGenerationService.adaptForDeliveryMode([objectivesSlide], 'hybrid');

      expect(adapted[0].speakerNotes).toContain('Synchronous Session');
    });

    it('should add hybrid facilitation notes', () => {
      const slide = createSampleSlide();
      const adapted = pptGenerationService.adaptForDeliveryMode([slide], 'hybrid');

      expect(adapted[0].speakerNotes).toContain('[Hybrid Facilitation]');
      expect(adapted[0].speakerNotes).toContain('in-person and online students');
    });
  });

  describe('Delivery Mode Normalization', () => {
    it('should handle various in-person format variations', () => {
      const slide = createSampleSlide();

      const variations = ['in-person', 'inperson', 'in_person', 'IN-PERSON'];
      variations.forEach((mode) => {
        const adapted = pptGenerationService.adaptForDeliveryMode([slide], mode);
        expect(adapted[0].speakerNotes).toContain('[Facilitation]');
      });
    });

    it('should handle various online formats', () => {
      const slide = createSampleSlide();

      const variations = ['online-facilitated', 'onlinefacilitated', 'online_facilitated'];
      variations.forEach((mode) => {
        const adapted = pptGenerationService.adaptForDeliveryMode([slide], mode);
        expect(adapted[0].speakerNotes).toContain('[Step-by-Step Instructions]');
      });
    });

    it('should handle blended as hybrid', () => {
      const slide = createSampleSlide();
      const adapted = pptGenerationService.adaptForDeliveryMode([slide], 'blended');

      expect(adapted[0].speakerNotes).toContain('[Hybrid Facilitation]');
    });
  });
});
