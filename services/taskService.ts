
import { supabase } from './supabaseClient';
import { Order, BlockType } from '../types';

// Helper to map DB task to Application "Order" (Task) type
const mapTaskToOrder = (task: any): Order => {
    // Extract assignee from task_assignments if joined
    // Assumes task_assignments is joined as 'task_assignments'
    // For single assignment MVP
    const assignment = task.task_assignments?.[0];
    const assignedUserId = assignment?.user_id || task.creator_id; // Fallback to creator if no assignee

    return {
        id: task.id,
        protocol: `TSK-${new Date(task.created_at).getTime().toString().slice(-6)}`, // Virtual ID
        title: task.title,
        status: task.status,
        createdAt: task.created_at,
        userId: task.creator_id,
        userName: task.creator?.name || 'Sistema', // Join needed or fetch profiles
        blockType: 'tarefas',
        description: task.description,
        is_public: task.is_public,
        assigned_user_id: assignedUserId
    };
};

export const getTasks = async (): Promise<Order[]> => {
    const { data, error } = await supabase
        .from('tasks')
        .select(`
            *,
            creator:creator_id(name),
            task_assignments(user_id)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching tasks:', error);
        return [];
    }

    return data.map(mapTaskToOrder);
};

export const getTaskById = async (id: string): Promise<Order | null> => {
    const { data, error } = await supabase
        .from('tasks')
        .select(`
            *,
            creator:creator_id(name),
            task_assignments(user_id)
        `)
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching task:', error);
        return null;
    }

    return mapTaskToOrder(data);
};

export const createTask = async (task: Partial<Order>): Promise<Order | null> => {
    // 1. Insert Task
    const dbTask = {
        title: task.title,
        description: task.description,
        status: task.status || 'pending',
        is_public: task.is_public,
        creator_id: task.userId
    };

    const { data: newTask, error: taskError } = await supabase
        .from('tasks')
        .insert([dbTask])
        .select()
        .single();

    if (taskError) {
        console.error('Error creating task:', taskError);
        return null;
    }

    // 2. Insert Assignment (if assigned to someone else or even self)
    if (task.assigned_user_id) {
        const { error: assignError } = await supabase
            .from('task_assignments')
            .insert([{
                task_id: newTask.id,
                user_id: task.assigned_user_id
            }]);

        if (assignError) {
            console.error('Error assigning task:', assignError);
            // Non-critical (?) but good to know
        }
    }

    // Return optimistic object (or refetch)
    // We construct the return manually to avoid another round trip
    return {
        id: newTask.id,
        protocol: `TSK-${Date.now()}`,
        title: newTask.title,
        status: newTask.status,
        createdAt: newTask.created_at,
        userId: task.userId!,
        userName: task.userName!,
        blockType: 'tarefas',
        description: newTask.description,
        is_public: newTask.is_public,
        assigned_user_id: task.assigned_user_id
    };
};

export const updateTaskStatus = async (id: string, status: string): Promise<boolean> => {
    const { error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', id);

    if (error) {
        console.error('Error updating task status:', error);
        return false;
    }
    return true;
};

export const deleteTask = async (id: string): Promise<boolean> => {
    const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting task:', error);
        return false;
    }
    return true;
};
