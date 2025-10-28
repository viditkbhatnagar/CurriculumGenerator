import { Pool } from 'pg';
import { SimulationEngine } from '../services/simulationEngine';
import { CreateScenarioRequest, Scenario, ScenarioState } from '../types/simulation';
import { llmService } from '../services/llmService';

// Mock the LLM service
jest.mock('../services/llmService', () => ({
  llmService: {
    generateStructuredOutput: jest.fn(),
    generateContent: jest.fn(),
  },
}));

describe('SimulationEngine', () => {
  let mockPool: jest.Mocked<Pool>;
  let simulationEngine: SimulationEngine;
  let mockClient: any;

  beforeEach(() => {
    // Create mock pool
    mockPool = {
      connect: jest.fn(),
      query: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
    } as any;

    // Mock client
    mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };

    (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);

    // Reset mocks
    jest.clearAllMocks();

    simulationEngine = new SimulationEngine(mockPool);
  });

  describe('Task 14.1: Scenario Generation', () => {
    it('should create a scenario using template for known topics', async () => {
      const request: CreateScenarioRequest = {
        topic: 'business-communication',
        difficulty: 3,
        industry: 'Technology',
        roleType: 'Project Manager',
      };

      const scenario = await simulationEngine.createScenario(request);

      expect(scenario).toBeDefined();
      expect(scenario.scenarioId).toBeDefined();
      expect(scenario.title).toContain('Business Communication');
      expect(scenario.topic).toBe('business-communication');
      expect(scenario.difficulty).toBe(3);
      expect(scenario.context).toContain('Project Manager');
      expect(scenario.context).toContain('Technology');
      expect(scenario.initialState).toBeDefined();
      expect(scenario.initialState.availableActions.length).toBeGreaterThan(0);
      expect(scenario.learningObjectives).toBeDefined();
      expect(scenario.bestPractices).toBeDefined();
    });

    it('should create scenario with proper initial state structure', async () => {
      const request: CreateScenarioRequest = {
        topic: 'business-communication',
        difficulty: 2,
      };

      const scenario = await simulationEngine.createScenario(request);

      expect(scenario.initialState.currentSituation).toBeDefined();
      expect(scenario.initialState.availableActions).toBeInstanceOf(Array);
      expect(scenario.initialState.previousActions).toEqual([]);
      expect(scenario.initialState.feedback).toBe('');
      expect(scenario.initialState.score).toBe(0);
      expect(scenario.initialState.isComplete).toBe(false);
      expect(scenario.initialState.currentStep).toBe(1);
      expect(scenario.initialState.totalSteps).toBeGreaterThan(0);
    });

    it('should create actions with different categories', async () => {
      const request: CreateScenarioRequest = {
        topic: 'business-communication',
        difficulty: 3,
      };

      const scenario = await simulationEngine.createScenario(request);

      const categories = scenario.initialState.availableActions.map(a => a.category);
      const uniqueCategories = new Set(categories);

      // Should have multiple action categories
      expect(uniqueCategories.size).toBeGreaterThan(1);
      
      // Each action should have required properties
      scenario.initialState.availableActions.forEach(action => {
        expect(action.actionId).toBeDefined();
        expect(action.description).toBeDefined();
        expect(action.category).toMatch(/analysis|communication|decision|implementation/);
      });
    });

    it('should adjust difficulty by changing total steps', async () => {
      const easyRequest: CreateScenarioRequest = {
        topic: 'business-communication',
        difficulty: 1,
      };

      const hardRequest: CreateScenarioRequest = {
        topic: 'business-communication',
        difficulty: 5,
      };

      const easyScenario = await simulationEngine.createScenario(easyRequest);
      const hardScenario = await simulationEngine.createScenario(hardRequest);

      // Harder scenarios should have more steps
      expect(hardScenario.initialState.totalSteps).toBeGreaterThan(
        easyScenario.initialState.totalSteps
      );
    });

    it('should include metadata with estimated duration', async () => {
      const request: CreateScenarioRequest = {
        topic: 'business-communication',
        difficulty: 3,
        industry: 'Healthcare',
        roleType: 'Manager',
      };

      const scenario = await simulationEngine.createScenario(request);

      expect(scenario.metadata).toBeDefined();
      expect(scenario.metadata?.industry).toBe('Healthcare');
      expect(scenario.metadata?.roleType).toBe('Manager');
      expect(scenario.metadata?.estimatedDuration).toBeGreaterThan(0);
    });
  });

  describe('Task 14.2: Scenario Interaction and Evaluation', () => {
    let testScenario: Scenario;
    const studentId = 'test-student-123';

    beforeEach(async () => {
      // Create a test scenario
      testScenario = await simulationEngine.createScenario({
        topic: 'business-communication',
        difficulty: 2,
      });

      // Mock scenario retrieval
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM simulations')) {
          return Promise.resolve({
            rows: [{
              scenario_id: testScenario.scenarioId,
              title: testScenario.title,
              context: testScenario.context,
              topic: testScenario.topic,
              difficulty: testScenario.difficulty,
              initial_state: testScenario.initialState,
              learning_objectives: testScenario.learningObjectives,
              best_practices: testScenario.bestPractices,
              created_at: testScenario.createdAt,
              metadata: testScenario.metadata,
            }],
          });
        }
        return Promise.resolve({ rows: [] });
      });
    });

    describe('processAction', () => {
      it('should process student action and update scenario state', async () => {
        // Mock progress retrieval - initial state
        mockClient.query.mockImplementation((query: string) => {
          if (query.includes('SELECT * FROM simulation_progress')) {
            return Promise.resolve({
              rows: [{
                scenario_id: testScenario.scenarioId,
                student_id: studentId,
                current_state: testScenario.initialState,
                started_at: new Date(),
                last_action_at: new Date(),
                is_complete: false,
              }],
            });
          }
          if (query.includes('SELECT * FROM simulations')) {
            return Promise.resolve({
              rows: [{
                scenario_id: testScenario.scenarioId,
                title: testScenario.title,
                context: testScenario.context,
                topic: testScenario.topic,
                difficulty: testScenario.difficulty,
                initial_state: testScenario.initialState,
                learning_objectives: testScenario.learningObjectives,
                best_practices: testScenario.bestPractices,
                created_at: testScenario.createdAt,
                metadata: testScenario.metadata,
              }],
            });
          }
          return Promise.resolve({ rows: [] });
        });

        // Mock LLM responses for feedback and next state
        (llmService.generateStructuredOutput as jest.Mock).mockResolvedValue({
          immediate: 'Good decision! This shows strong analytical thinking.',
          consequences: 'Your thorough analysis helps identify the root cause.',
          situation: 'Based on your analysis, you now need to communicate findings.',
          actions: [
            {
              actionId: 'action_next_1',
              description: 'Present findings to stakeholders',
              category: 'communication',
              isOptimal: true,
            },
            {
              actionId: 'action_next_2',
              description: 'Skip communication and implement solution',
              category: 'implementation',
              isOptimal: false,
            },
          ],
        });

        const firstAction = testScenario.initialState.availableActions[0];
        
        const newState = await simulationEngine.processAction({
          scenarioId: testScenario.scenarioId,
          studentId,
          actionId: firstAction.actionId,
        });

        // Verify state was updated
        expect(newState).toBeDefined();
        expect(newState.currentStep).toBe(2);
        expect(newState.previousActions.length).toBe(1);
        expect(newState.previousActions[0].actionId).toBe(firstAction.actionId);
        expect(newState.score).toBeGreaterThan(0);
        expect(newState.feedback).toBeDefined();
        expect(newState.isComplete).toBe(false);
      });

      it('should track student choices throughout simulation', async () => {
        // Mock progress with some previous actions
        const previousActions = [
          {
            actionId: 'action_1',
            description: 'First action',
            timestamp: new Date(),
            score: 15,
            feedback: 'Good choice',
            consequences: 'Positive outcome',
          },
        ];

        mockClient.query.mockImplementation((query: string) => {
          if (query.includes('SELECT * FROM simulation_progress')) {
            return Promise.resolve({
              rows: [{
                scenario_id: testScenario.scenarioId,
                student_id: studentId,
                current_state: {
                  ...testScenario.initialState,
                  currentStep: 2,
                  previousActions,
                  score: 15,
                },
                started_at: new Date(),
                last_action_at: new Date(),
                is_complete: false,
              }],
            });
          }
          if (query.includes('SELECT * FROM simulations')) {
            return Promise.resolve({
              rows: [{
                scenario_id: testScenario.scenarioId,
                title: testScenario.title,
                context: testScenario.context,
                topic: testScenario.topic,
                difficulty: testScenario.difficulty,
                initial_state: testScenario.initialState,
                learning_objectives: testScenario.learningObjectives,
                best_practices: testScenario.bestPractices,
                created_at: testScenario.createdAt,
                metadata: testScenario.metadata,
              }],
            });
          }
          return Promise.resolve({ rows: [] });
        });

        (llmService.generateStructuredOutput as jest.Mock).mockResolvedValue({
          immediate: 'Another good decision.',
          consequences: 'Progress continues.',
          situation: 'Next situation',
          actions: [],
        });

        const action = testScenario.initialState.availableActions[0];
        const newState = await simulationEngine.processAction({
          scenarioId: testScenario.scenarioId,
          studentId,
          actionId: action.actionId,
        });

        // Should have tracked both actions
        expect(newState.previousActions.length).toBe(2);
        expect(newState.previousActions[0]).toEqual(previousActions[0]);
      });

      it('should throw error if scenario is already complete', async () => {
        mockClient.query.mockImplementation((query: string) => {
          if (query.includes('SELECT * FROM simulation_progress')) {
            return Promise.resolve({
              rows: [{
                scenario_id: testScenario.scenarioId,
                student_id: studentId,
                current_state: {
                  ...testScenario.initialState,
                  isComplete: true,
                },
                started_at: new Date(),
                last_action_at: new Date(),
                is_complete: true,
              }],
            });
          }
          return Promise.resolve({ rows: [] });
        });

        const action = testScenario.initialState.availableActions[0];
        
        await expect(
          simulationEngine.processAction({
            scenarioId: testScenario.scenarioId,
            studentId,
            actionId: action.actionId,
          })
        ).rejects.toThrow('already complete');
      });

      it('should throw error for invalid action ID', async () => {
        mockClient.query.mockImplementation((query: string) => {
          if (query.includes('SELECT * FROM simulation_progress')) {
            return Promise.resolve({
              rows: [{
                scenario_id: testScenario.scenarioId,
                student_id: studentId,
                current_state: testScenario.initialState,
                started_at: new Date(),
                last_action_at: new Date(),
                is_complete: false,
              }],
            });
          }
          if (query.includes('SELECT * FROM simulations')) {
            return Promise.resolve({
              rows: [{
                scenario_id: testScenario.scenarioId,
                title: testScenario.title,
                context: testScenario.context,
                topic: testScenario.topic,
                difficulty: testScenario.difficulty,
                initial_state: testScenario.initialState,
                learning_objectives: testScenario.learningObjectives,
                best_practices: testScenario.bestPractices,
                created_at: testScenario.createdAt,
                metadata: testScenario.metadata,
              }],
            });
          }
          return Promise.resolve({ rows: [] });
        });

        await expect(
          simulationEngine.processAction({
            scenarioId: testScenario.scenarioId,
            studentId,
            actionId: 'invalid-action-id',
          })
        ).rejects.toThrow('Invalid action');
      });
    });

    describe('evaluatePerformance', () => {
      it('should generate performance report with score 0-100', async () => {
        // Mock completed scenario progress
        const completedActions = [
          {
            actionId: 'action_1',
            description: 'Analyzed the situation',
            timestamp: new Date(),
            score: 20,
            feedback: 'Excellent analysis',
            consequences: 'Clear understanding achieved',
          },
          {
            actionId: 'action_2',
            description: 'Communicated with team',
            timestamp: new Date(),
            score: 18,
            feedback: 'Good communication',
            consequences: 'Team aligned',
          },
          {
            actionId: 'action_3',
            description: 'Made decision',
            timestamp: new Date(),
            score: 15,
            feedback: 'Reasonable decision',
            consequences: 'Progress made',
          },
        ];

        mockClient.query.mockImplementation((query: string) => {
          if (query.includes('SELECT * FROM simulation_progress')) {
            return Promise.resolve({
              rows: [{
                scenario_id: testScenario.scenarioId,
                student_id: studentId,
                current_state: {
                  ...testScenario.initialState,
                  currentStep: 6,
                  totalSteps: 5,
                  previousActions: completedActions,
                  score: 53,
                  isComplete: true,
                },
                started_at: new Date(Date.now() - 300000), // 5 minutes ago
                last_action_at: new Date(),
                is_complete: true,
              }],
            });
          }
          if (query.includes('SELECT * FROM simulations')) {
            return Promise.resolve({
              rows: [{
                scenario_id: testScenario.scenarioId,
                title: testScenario.title,
                context: testScenario.context,
                topic: testScenario.topic,
                difficulty: testScenario.difficulty,
                initial_state: testScenario.initialState,
                learning_objectives: testScenario.learningObjectives,
                best_practices: testScenario.bestPractices,
                created_at: testScenario.createdAt,
                metadata: testScenario.metadata,
              }],
            });
          }
          return Promise.resolve({ rows: [] });
        });

        (llmService.generateContent as jest.Mock).mockResolvedValue(
          'You demonstrated good analytical and communication skills throughout the scenario. Your decisions were generally sound, though there is room for improvement in implementation timing.'
        );

        (llmService.generateStructuredOutput as jest.Mock).mockResolvedValue({
          recommendations: [
            'Practice more complex decision-making scenarios',
            'Focus on implementation timing',
            'Continue developing communication skills',
          ],
        });

        const report = await simulationEngine.evaluatePerformance(
          testScenario.scenarioId,
          studentId
        );

        // Verify report structure
        expect(report).toBeDefined();
        expect(report.scenarioId).toBe(testScenario.scenarioId);
        expect(report.studentId).toBe(studentId);
        expect(report.overallScore).toBeGreaterThanOrEqual(0);
        expect(report.overallScore).toBeLessThanOrEqual(100);
        expect(report.actionsCount).toBe(3);
        expect(report.completionTime).toBeGreaterThan(0);
        expect(report.categoryScores).toBeDefined();
        expect(report.categoryScores.analysis).toBeDefined();
        expect(report.categoryScores.communication).toBeDefined();
        expect(report.categoryScores.decision).toBeDefined();
        expect(report.categoryScores.implementation).toBeDefined();
        expect(report.strengths).toBeInstanceOf(Array);
        expect(report.areasForImprovement).toBeInstanceOf(Array);
        expect(report.detailedFeedback).toBeDefined();
        expect(report.recommendations).toBeInstanceOf(Array);
      });

      it('should throw error if scenario is not complete', async () => {
        mockClient.query.mockImplementation((query: string) => {
          if (query.includes('SELECT * FROM simulation_progress')) {
            return Promise.resolve({
              rows: [{
                scenario_id: testScenario.scenarioId,
                student_id: studentId,
                current_state: {
                  ...testScenario.initialState,
                  isComplete: false,
                },
                started_at: new Date(),
                last_action_at: new Date(),
                is_complete: false,
              }],
            });
          }
          return Promise.resolve({ rows: [] });
        });

        await expect(
          simulationEngine.evaluatePerformance(testScenario.scenarioId, studentId)
        ).rejects.toThrow('must be completed');
      });

      it('should identify strengths and areas for improvement', async () => {
        const completedActions = [
          {
            actionId: 'action_1',
            description: 'Strong analysis',
            timestamp: new Date(),
            score: 22,
            feedback: 'Excellent',
            consequences: 'Great outcome',
          },
          {
            actionId: 'action_2',
            description: 'Poor decision',
            timestamp: new Date(),
            score: 5,
            feedback: 'Needs improvement',
            consequences: 'Suboptimal result',
          },
        ];

        mockClient.query.mockImplementation((query: string) => {
          if (query.includes('SELECT * FROM simulation_progress')) {
            return Promise.resolve({
              rows: [{
                scenario_id: testScenario.scenarioId,
                student_id: studentId,
                current_state: {
                  ...testScenario.initialState,
                  currentStep: 3,
                  totalSteps: 2,
                  previousActions: completedActions,
                  score: 27,
                  isComplete: true,
                },
                started_at: new Date(Date.now() - 180000),
                last_action_at: new Date(),
                is_complete: true,
              }],
            });
          }
          if (query.includes('SELECT * FROM simulations')) {
            return Promise.resolve({
              rows: [{
                scenario_id: testScenario.scenarioId,
                title: testScenario.title,
                context: testScenario.context,
                topic: testScenario.topic,
                difficulty: testScenario.difficulty,
                initial_state: testScenario.initialState,
                learning_objectives: testScenario.learningObjectives,
                best_practices: testScenario.bestPractices,
                created_at: testScenario.createdAt,
                metadata: testScenario.metadata,
              }],
            });
          }
          return Promise.resolve({ rows: [] });
        });

        (llmService.generateContent as jest.Mock).mockResolvedValue('Feedback text');
        (llmService.generateStructuredOutput as jest.Mock).mockResolvedValue({
          recommendations: ['Improve decision-making'],
        });

        const report = await simulationEngine.evaluatePerformance(
          testScenario.scenarioId,
          studentId
        );

        // Should have both strengths and areas for improvement
        expect(report.strengths.length).toBeGreaterThan(0);
        expect(report.areasForImprovement.length).toBeGreaterThan(0);
      });
    });

    describe('resetScenario', () => {
      it('should reset scenario to initial state for replay', async () => {
        mockClient.query.mockImplementation((query: string) => {
          if (query.includes('SELECT * FROM simulations')) {
            return Promise.resolve({
              rows: [{
                scenario_id: testScenario.scenarioId,
                title: testScenario.title,
                context: testScenario.context,
                topic: testScenario.topic,
                difficulty: testScenario.difficulty,
                initial_state: testScenario.initialState,
                learning_objectives: testScenario.learningObjectives,
                best_practices: testScenario.bestPractices,
                created_at: testScenario.createdAt,
                metadata: testScenario.metadata,
              }],
            });
          }
          return Promise.resolve({ rows: [] });
        });

        const resetState = await simulationEngine.resetScenario(
          testScenario.scenarioId,
          studentId
        );

        // Should match initial state
        expect(resetState.currentStep).toBe(1);
        expect(resetState.previousActions).toEqual([]);
        expect(resetState.score).toBe(0);
        expect(resetState.isComplete).toBe(false);
        expect(resetState.feedback).toBe('');
      });

      it('should allow different choices on replay', async () => {
        mockClient.query.mockImplementation((query: string) => {
          if (query.includes('SELECT * FROM simulations')) {
            return Promise.resolve({
              rows: [{
                scenario_id: testScenario.scenarioId,
                title: testScenario.title,
                context: testScenario.context,
                topic: testScenario.topic,
                difficulty: testScenario.difficulty,
                initial_state: testScenario.initialState,
                learning_objectives: testScenario.learningObjectives,
                best_practices: testScenario.bestPractices,
                created_at: testScenario.createdAt,
                metadata: testScenario.metadata,
              }],
            });
          }
          return Promise.resolve({ rows: [] });
        });

        const resetState = await simulationEngine.resetScenario(
          testScenario.scenarioId,
          studentId
        );

        // Should have all original actions available
        expect(resetState.availableActions.length).toBeGreaterThan(0);
        expect(resetState.availableActions).toEqual(
          testScenario.initialState.availableActions
        );
      });
    });
  });
});
