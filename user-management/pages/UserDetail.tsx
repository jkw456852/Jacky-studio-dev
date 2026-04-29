import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/user.store';
import { useForm } from '../hooks/useForm';
import { userUpdateSchema } from '../types/schemas';
import Card from '../components/Layout/Card';
import Form from '../components/Form/Form';
import Input from '../components/Form/Input';
import Select from '../components/Form/Select';
import Button from '../components/Form/Button';
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  Edit, 
  Save, 
  X, 
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

const UserDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { updateUser, isLoading, error, fetchUsers } = useUserStore();
  
  const [user, setUser] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  const { formData, errors, isLoading: formLoading, handleChange, handleSubmit, setFormData } = useForm({
    schema: userUpdateSchema,
    defaultValues: {
      email: '',
      username: '',
      fullName: '',
      phone: '',
      status: 'active' as const,
      role: '',
    },
    onSubmit: async (data) => {
      if (!id) return;
      
      setUpdateError(null);
      const result = await updateUser(id, data);
      
      if (result) {
        setUpdateSuccess(true);
        setUser(result);
        setIsEditing(false);
        
        // 3秒后隐藏成功消息
        setTimeout(() => {
          setUpdateSuccess(false);
        }, 3000);
      } else {
        setUpdateError('更新失败，请稍后重试');
      }
    },
  });

  // 加载用户数据
  useEffect(() => {
    const loadUser = async () => {
      if (!id) return;
      
      setIsLoadingUser(true);
      try {
        // TODO: 调用后端API获取单个用户
        // 这里先模拟从store中获取
        await fetchUsers();
        const users = useUserStore.getState().users;
        const foundUser = users.find(u => u.id === id);
        
        if (foundUser) {
          setUser(foundUser);
          setFormData({
            email: foundUser.email,
            username: foundUser.username,
            fullName: foundUser.fullName || '',
            phone: foundUser.phone || '',
            status: foundUser.status,
            role: foundUser.role,
          });
        } else {
          // 如果找不到用户，尝试获取详情
          // TODO: 调用获取单个用户的API
        }
      } catch (error) {
        console.error('加载用户失败:', error);
      } finally {
        setIsLoadingUser(false);
      }
    };

    loadUser();
  }, [id]);

  const handleSave = (e: React.FormEvent) => {
    handleSubmit(e);
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (user) {
      setFormData({
        email: user.email,
        username: user.username,
        fullName: user.fullName || '',
        phone: user.phone || '',
        status: user.status,
        role: user.role,
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-yellow-100 text-yellow-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4" />;
      case 'inactive':
        return <AlertCircle className="h-4 w-4" />;
      case 'suspended':
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return '活跃';
      case 'inactive':
        return '未激活';
      case 'suspended':
        return '已停用';
      default:
        return status;
    }
  };

  if (isLoadingUser) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <div className="text-center py-12">
              <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">用户不存在</h3>
              <p className="mt-2 text-sm text-gray-600">
                请求的用户不存在或已被删除。
              </p>
              <div className="mt-6">
                <Button
                  variant="primary"
                  onClick={() => navigate('/admin/users')}
                  leftIcon={<ArrowLeft className="h-4 w-4" />}
                >
                  返回用户列表
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* 头部操作栏 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => navigate('/admin/users')}
              leftIcon={<ArrowLeft className="h-4 w-4" />}
            >
              返回
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">用户详情</h1>
          </div>

          <div className="flex items-center space-x-2">
            {!isEditing ? (
              <Button
                variant="primary"
                onClick={() => setIsEditing(true)}
                leftIcon={<Edit className="h-4 w-4" />}
              >
                编辑
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  leftIcon={<X className="h-4 w-4" />}
                >
                  取消
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  loading={formLoading}
                  leftIcon={<Save className="h-4 w-4" />}
                >
                  保存
                </Button>
              </>
            )}
          </div>
        </div>

        {/* 成功/错误消息 */}
        {updateSuccess && (
          <div className="mb-6">
            <div className="rounded-md bg-green-50 p-4">
              <div className="flex">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800">
                    用户信息已更新
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {updateError && (
          <div className="mb-6">
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800">
                    {updateError}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧信息卡片 */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.username}
                        className="h-16 w-16 rounded-full"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="h-8 w-8 text-blue-600" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {user.fullName || user.username}
                    </h3>
                    <p className="text-sm text-gray-600">@{user.username}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                      {getStatusIcon(user.status)}
                      <span className="ml-1">{getStatusText(user.status)}</span>
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      <Shield className="h-3 w-3 mr-1" />
                      {user.role}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <Card title="账户信息">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">用户ID</span>
                  <span className="text-sm font-medium text-gray-900">{user.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">创建时间</span>
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-3 w-3 text-gray-400" />
                    <span className="text-sm text-gray-900">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">更新时间</span>
                  <div className="flex items-center space-x-1">
                    <Clock className="h-3 w-3 text-gray-400" />
                    <span className="text-sm text-gray-900">
                      {new Date(user.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {user.lastLoginAt && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">最后登录</span>
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3 text-gray-400" />
                      <span className="text-sm text-gray-900">
                        {new Date(user.lastLoginAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* 右侧编辑表单 */}
          <div className="lg:col-span-2">
            <Card title={isEditing ? "编辑用户信息" : "用户信息"}>
              <Form error={error?.message}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="邮箱地址"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email')(e.target.value)}
                    error={errors.email}
                    leftIcon={<Mail className="h-4 w-4 text-gray-400" />}
                    disabled={!isEditing}
                  />

                  <Input
                    label="用户名"
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={(e) => handleChange('username')(e.target.value)}
                    error={errors.username}
                    leftIcon={<User className="h-4 w-4 text-gray-400" />}
                    disabled={!isEditing}
                  />

                  <Input
                    label="姓名"
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={(e) => handleChange('fullName')(e.target.value)}
                    error={errors.fullName}
                    leftIcon={<User className="h-4 w-4 text-gray-400" />}
                    disabled={!isEditing}
                  />

                  <Input
                    label="手机号"
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone')(e.target.value)}
                    error={errors.phone}
                    leftIcon={<Phone className="h-4 w-4 text-gray-400" />}
                    disabled={!isEditing}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    label="状态"
                    name="status"
                    value={formData.status}
                    onChange={(value) => handleChange('status')(value)}
                    error={errors.status}
                    options={[
                      { value: 'active', label: '活跃' },
                      { value: 'inactive', label: '未激活' },
                      { value: 'suspended', label: '已停用' },
                    ]}
                    disabled={!isEditing}
                  />

                  <Select
                    label="角色"
                    name="role"
                    value={formData.role}
                    onChange={(value) => handleChange('role')(value)}
                    error={errors.role}
                    options={[
                      { value: 'admin', label: '管理员' },
                      { value: 'user', label: '普通用户' },
                      { value: 'editor', label: '编辑者' },
                      { value: 'viewer', label: '查看者' },
                    ]}
                    disabled={!isEditing}
                  />
                </div>
              </Form>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDetailPage;